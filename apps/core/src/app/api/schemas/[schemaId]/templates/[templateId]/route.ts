import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";
import { z } from "zod";

const updateTemplateSchema = z.object({
  templateName: z.string().min(1).max(100).optional(),
  config: z.string().optional(),
  description: z.string().max(500).optional(),
});

async function getTemplate(templateId: string, userId: string) {
  return prisma.exportTemplate.findFirst({
    where: { id: templateId, schema: { userId } },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ schemaId: string; templateId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { templateId } = await params;
  const template = await getTemplate(templateId, session.user.id);
  if (!template) {
    return NextResponse.json({ error: "模板不存在" }, { status: 404 });
  }

  return NextResponse.json({ ...template, config: JSON.parse(template.config) });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ schemaId: string; templateId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { templateId } = await params;
  const existing = await getTemplate(templateId, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "模板不存在" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = updateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "输入无效" },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.templateName) data.templateName = parsed.data.templateName;
    if (parsed.data.config) data.config = parsed.data.config;
    if (parsed.data.description !== undefined) data.description = parsed.data.description;

    const updated = await prisma.exportTemplate.update({
      where: { id: templateId },
      data,
    });

    return NextResponse.json({ ...updated, config: JSON.parse(updated.config) });
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ schemaId: string; templateId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { templateId } = await params;
  const existing = await getTemplate(templateId, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "模板不存在" }, { status: 404 });
  }

  await prisma.exportTemplate.delete({ where: { id: templateId } });

  return NextResponse.json({ success: true });
}
