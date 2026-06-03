import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";
import { z } from "zod";

const updateStepSchema = z.object({
  stepType: z.string().optional(),
  label: z.string().max(100).optional(),
  config: z.any().optional(),
  sourceTableId: z.string().nullable().optional(),
  stepOrder: z.number().int().min(0).optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ schemaId: string; pipelineId: string; stepId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { schemaId, pipelineId, stepId } = await params;

  const step = await prisma.pipelineStep.findFirst({
    where: {
      id: stepId,
      pipeline: {
        id: pipelineId,
        schema: { id: schemaId, userId: session.user.id },
      },
    },
  });
  if (!step) {
    return NextResponse.json({ error: "步骤不存在" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateStepSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "输入数据无效" },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.stepType !== undefined) updateData.stepType = parsed.data.stepType;
  if (parsed.data.label !== undefined) updateData.label = parsed.data.label;
  if (parsed.data.config !== undefined) updateData.config = JSON.stringify(parsed.data.config);
  if (parsed.data.sourceTableId !== undefined) updateData.sourceTableId = parsed.data.sourceTableId;
  if (parsed.data.stepOrder !== undefined) updateData.stepOrder = parsed.data.stepOrder;

  // If stepType changed, reset status
  if (parsed.data.stepType && parsed.data.stepType !== step.stepType) {
    updateData.status = "PENDING";
    updateData.errorLog = null;
  }

  const updated = await prisma.pipelineStep.update({
    where: { id: stepId },
    data: updateData,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ schemaId: string; pipelineId: string; stepId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { schemaId, pipelineId, stepId } = await params;

  const step = await prisma.pipelineStep.findFirst({
    where: {
      id: stepId,
      pipeline: {
        id: pipelineId,
        schema: { id: schemaId, userId: session.user.id },
      },
    },
  });
  if (!step) {
    return NextResponse.json({ error: "步骤不存在" }, { status: 404 });
  }

  // Drop temp table
  if (step.outputPhysicalName) {
    try {
      await prisma.$executeRawUnsafe(
        `DROP TABLE IF EXISTS "${step.outputPhysicalName.replace(/[^a-z0-9_]/gi, "")}"`
      );
    } catch {
      // Ignore
    }
  }

  await prisma.pipelineStep.delete({ where: { id: stepId } });

  // Re-order remaining steps
  const remainingSteps = await prisma.pipelineStep.findMany({
    where: { pipelineId },
    orderBy: { stepOrder: "asc" },
  });

  for (let i = 0; i < remainingSteps.length; i++) {
    if (remainingSteps[i].stepOrder !== i) {
      await prisma.pipelineStep.update({
        where: { id: remainingSteps[i].id },
        data: { stepOrder: i },
      });
    }
  }

  return NextResponse.json({ success: true });
}
