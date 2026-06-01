import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const createTemplateSchema = z.object({
  templateName: z.string().min(1).max(100),
  config: z.string().min(1),
  description: z.string().max(500).optional(),
});

export async function GET(
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
    return NextResponse.json({ error: "数据模型不存在" }, { status: 404 });
  }

  const templates = await prisma.exportTemplate.findMany({
    where: { schemaId },
    orderBy: { createdAt: "desc" },
  });

  // Parse config JSON for the response
  return NextResponse.json(
    templates.map((t) => ({
      ...t,
      config: JSON.parse(t.config),
    }))
  );
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
    return NextResponse.json({ error: "数据模型不存在" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "输入无效" },
        { status: 400 }
      );
    }

    const template = await prisma.exportTemplate.create({
      data: {
        schemaId,
        templateName: parsed.data.templateName,
        config: typeof parsed.data.config === "string"
          ? parsed.data.config
          : JSON.stringify(parsed.data.config),
        description: parsed.data.description,
      },
    });

    return NextResponse.json(
      { ...template, config: JSON.parse(template.config) },
      { status: 201 }
    );
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2002") {
      return NextResponse.json(
        { error: "已存在同名模板" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
