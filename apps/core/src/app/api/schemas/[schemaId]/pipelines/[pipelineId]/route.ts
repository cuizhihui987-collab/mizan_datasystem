import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  edges: z.string().optional(), // JSON string of edge connections
});

async function getPipeline(schemaId: string, pipelineId: string, userId: string) {
  const schema = await prisma.schema.findFirst({
    where: { id: schemaId, userId },
  });
  if (!schema) return null;

  return prisma.pipelineDefinition.findFirst({
    where: { id: pipelineId, schemaId },
    include: {
      steps: { orderBy: { stepOrder: "asc" } },
    },
  });
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

  const pipeline = await getPipeline(schemaId, pipelineId, session.user.id);
  if (!pipeline) {
    return NextResponse.json({ error: "Pipeline 不存在" }, { status: 404 });
  }

  return NextResponse.json(pipeline);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ schemaId: string; pipelineId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { schemaId, pipelineId } = await params;

  const pipeline = await getPipeline(schemaId, pipelineId, session.user.id);
  if (!pipeline) {
    return NextResponse.json({ error: "Pipeline 不存在" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "输入数据无效" },
      { status: 400 }
    );
  }

  // Check name uniqueness if changed
  if (parsed.data.name && parsed.data.name !== pipeline.name) {
    const existing = await prisma.pipelineDefinition.findUnique({
      where: { schemaId_name: { schemaId, name: parsed.data.name } },
    });
    if (existing) {
      return NextResponse.json({ error: "该名称已存在" }, { status: 409 });
    }
  }

  const updated = await prisma.pipelineDefinition.update({
    where: { id: pipelineId },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ schemaId: string; pipelineId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { schemaId, pipelineId } = await params;

  const pipeline = await getPipeline(schemaId, pipelineId, session.user.id);
  if (!pipeline) {
    return NextResponse.json({ error: "Pipeline 不存在" }, { status: 404 });
  }

  // Drop all temp tables for this pipeline's steps
  for (const step of pipeline.steps) {
    if (step.outputPhysicalName) {
      try {
        await prisma.$executeRawUnsafe(
          `DROP TABLE IF EXISTS "${step.outputPhysicalName.replace(/[^a-z0-9_]/gi, "")}"`
        );
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  await prisma.pipelineDefinition.delete({ where: { id: pipelineId } });

  return NextResponse.json({ success: true });
}
