import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const updateViewSchema = z.object({
  viewName: z.string().min(1).max(100).optional(),
  sql: z.string().min(1).optional(),
  description: z.string().max(500).optional(),
});

async function getView(viewId: string, userId: string) {
  return prisma.viewDefinition.findFirst({
    where: { id: viewId, schema: { userId } },
  });
}

// GET /api/schemas/[schemaId]/views/[viewId] — Get a view
export async function GET(
  req: Request,
  { params }: { params: Promise<{ schemaId: string; viewId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { viewId } = await params;
  const view = await getView(viewId, session.user.id);
  if (!view) {
    return NextResponse.json({ error: "视图不存在" }, { status: 404 });
  }

  return NextResponse.json(view);
}

// PUT /api/schemas/[schemaId]/views/[viewId] — Update view
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ schemaId: string; viewId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { viewId } = await params;

  const existing = await getView(viewId, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "视图不存在" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = updateViewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "输入无效" },
        { status: 400 }
      );
    }

    const updated = await prisma.viewDefinition.update({
      where: { id: viewId },
      data: parsed.data,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

// DELETE /api/schemas/[schemaId]/views/[viewId] — Delete view
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ schemaId: string; viewId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { viewId } = await params;

  const existing = await getView(viewId, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "视图不存在" }, { status: 404 });
  }

  // Drop the view if it was created
  try {
    await prisma.$executeRawUnsafe(
      `DROP VIEW IF EXISTS "${existing.viewName}"`
    );
  } catch {
    // View may not exist in SQLite
  }

  await prisma.viewDefinition.delete({ where: { id: viewId } });

  return NextResponse.json({ success: true });
}
