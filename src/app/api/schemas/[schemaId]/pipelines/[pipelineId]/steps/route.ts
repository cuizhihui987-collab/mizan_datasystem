import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const VALID_STEP_TYPES = [
  "source_import", "source_table", "source_api",
  "transform_sql", "transform_merge", "transform_filter",
  "output_table",
] as const;

const createStepSchema = z.object({
  stepType: z.enum(VALID_STEP_TYPES),
  label: z.string().max(100).optional(),
  config: z.any().optional(),
  sourceTableId: z.string().optional(),
  stepOrder: z.number().int().min(0).optional(),
});

async function generatePhysicalName(): Promise<string> {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "mzan_pipe_";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ schemaId: string; pipelineId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { schemaId, pipelineId } = await params;

  const pipeline = await prisma.pipelineDefinition.findFirst({
    where: { id: pipelineId, schema: { id: schemaId, userId: session.user.id } },
  });
  if (!pipeline) {
    return NextResponse.json({ error: "Pipeline 不存在" }, { status: 404 });
  }

  const steps = await prisma.pipelineStep.findMany({
    where: { pipelineId },
    orderBy: { stepOrder: "asc" },
    include: { sourceTable: { select: { id: true, logicalName: true, physicalName: true } } },
  });

  return NextResponse.json(steps);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ schemaId: string; pipelineId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { schemaId, pipelineId } = await params;

  const pipeline = await prisma.pipelineDefinition.findFirst({
    where: { id: pipelineId, schema: { id: schemaId, userId: session.user.id } },
  });
  if (!pipeline) {
    return NextResponse.json({ error: "Pipeline 不存在" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = createStepSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "输入数据无效" },
      { status: 400 }
    );
  }

  // Auto-compute stepOrder if not specified
  let stepOrder = parsed.data.stepOrder;
  if (stepOrder === undefined) {
    const lastStep = await prisma.pipelineStep.findFirst({
      where: { pipelineId },
      orderBy: { stepOrder: "desc" },
    });
    stepOrder = (lastStep?.stepOrder ?? -1) + 1;
  }

  const outputPhysicalName = await generatePhysicalName();

  const step = await prisma.pipelineStep.create({
    data: {
      pipelineId,
      stepOrder,
      stepType: parsed.data.stepType,
      label: parsed.data.label || null,
      config: JSON.stringify(parsed.data.config || {}),
      sourceTableId: parsed.data.sourceTableId || null,
      outputPhysicalName,
      status: "PENDING",
    },
  });

  return NextResponse.json(step, { status: 201 });
}
