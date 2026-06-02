import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().max(200).optional().nullable(),
  tableId: z.string().optional().nullable(),
  chartType: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ schemaId: string; dashboardId: string; widgetId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { schemaId, dashboardId, widgetId } = await params;

  const dashboard = await prisma.dashboard.findFirst({
    where: { id: dashboardId, schema: { id: schemaId, userId: session.user.id } },
  });
  if (!dashboard) {
    return NextResponse.json({ error: "看板不存在" }, { status: 404 });
  }

  const widget = await prisma.dashboardWidget.findFirst({
    where: { id: widgetId, dashboardId },
  });
  if (!widget) {
    return NextResponse.json({ error: "Widget 不存在" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "参数错误" },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.tableId !== undefined) data.tableId = parsed.data.tableId;
  if (parsed.data.chartType !== undefined) data.chartType = parsed.data.chartType;
  if (parsed.data.config !== undefined) data.config = JSON.stringify(parsed.data.config);
  if (parsed.data.positionX !== undefined) data.positionX = parsed.data.positionX;
  if (parsed.data.positionY !== undefined) data.positionY = parsed.data.positionY;
  if (parsed.data.width !== undefined) data.width = parsed.data.width;
  if (parsed.data.height !== undefined) data.height = parsed.data.height;

  const updated = await prisma.dashboardWidget.update({
    where: { id: widgetId },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ schemaId: string; dashboardId: string; widgetId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { schemaId, dashboardId, widgetId } = await params;

  const dashboard = await prisma.dashboard.findFirst({
    where: { id: dashboardId, schema: { id: schemaId, userId: session.user.id } },
  });
  if (!dashboard) {
    return NextResponse.json({ error: "看板不存在" }, { status: 404 });
  }

  const widget = await prisma.dashboardWidget.findFirst({
    where: { id: widgetId, dashboardId },
  });
  if (!widget) {
    return NextResponse.json({ error: "Widget 不存在" }, { status: 404 });
  }

  await prisma.dashboardWidget.delete({ where: { id: widgetId } });

  return NextResponse.json({ success: true });
}
