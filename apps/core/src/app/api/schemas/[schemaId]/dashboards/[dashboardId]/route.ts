import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ schemaId: string; dashboardId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { schemaId, dashboardId } = await params;

  const dashboard = await prisma.dashboard.findFirst({
    where: { id: dashboardId, schema: { id: schemaId, userId: session.user.id } },
    include: {
      widgets: { orderBy: [{ positionY: "asc" }, { positionX: "asc" }] },
    },
  });
  if (!dashboard) {
    return NextResponse.json({ error: "看板不存在" }, { status: 404 });
  }

  return NextResponse.json(dashboard);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ schemaId: string; dashboardId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { schemaId, dashboardId } = await params;

  const dashboard = await prisma.dashboard.findFirst({
    where: { id: dashboardId, schema: { id: schemaId, userId: session.user.id } },
  });
  if (!dashboard) {
    return NextResponse.json({ error: "看板不存在" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "参数错误" },
      { status: 400 }
    );
  }

  const updated = await prisma.dashboard.update({
    where: { id: dashboardId },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ schemaId: string; dashboardId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { schemaId, dashboardId } = await params;

  const dashboard = await prisma.dashboard.findFirst({
    where: { id: dashboardId, schema: { id: schemaId, userId: session.user.id } },
  });
  if (!dashboard) {
    return NextResponse.json({ error: "看板不存在" }, { status: 404 });
  }

  // Widgets cascade on delete
  await prisma.dashboard.delete({ where: { id: dashboardId } });

  return NextResponse.json({ success: true });
}
