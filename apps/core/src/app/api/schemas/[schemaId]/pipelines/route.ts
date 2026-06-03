import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100),
  description: z.string().max(500).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ schemaId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { schemaId } = await params;

  const schema = await prisma.schema.findFirst({
    where: { id: schemaId, userId: session.user.id },
  });
  if (!schema) {
    return NextResponse.json({ error: "Schema 不存在" }, { status: 404 });
  }

  const pipelines = await prisma.pipelineDefinition.findMany({
    where: { schemaId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { steps: true } },
    },
  });

  return NextResponse.json(pipelines);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ schemaId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { schemaId } = await params;

  const schema = await prisma.schema.findFirst({
    where: { id: schemaId, userId: session.user.id },
  });
  if (!schema) {
    return NextResponse.json({ error: "Schema 不存在" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "输入数据无效" },
      { status: 400 }
    );
  }

  const existing = await prisma.pipelineDefinition.findUnique({
    where: { schemaId_name: { schemaId, name: parsed.data.name } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "该名称已存在" },
      { status: 409 }
    );
  }

  const pipeline = await prisma.pipelineDefinition.create({
    data: {
      schemaId,
      name: parsed.data.name,
      description: parsed.data.description,
    },
  });

  return NextResponse.json(pipeline, { status: 201 });
}
