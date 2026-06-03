import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().max(200).optional(),
  tableId: z.string().optional(),
  chartType: z.string().default("bar"),
  config: z.record(z.unknown()).default({}),
  positionX: z.number().int().default(0),
  positionY: z.number().int().default(1),
  width: z.number().int().default(6),
  height: z.number().int().default(4),
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
  });
  if (!dashboard) {
    return NextResponse.json({ error: "看板不存在" }, { status: 404 });
  }

  const widgets = await prisma.dashboardWidget.findMany({
    where: { dashboardId },
    orderBy: [{ positionY: "asc" }, { positionX: "asc" }],
  });

  return NextResponse.json(widgets);
}

export async function POST(
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "参数错误" },
      { status: 400 }
    );
  }

  const widget = await prisma.dashboardWidget.create({
    data: {
      dashboardId,
      title: parsed.data.title || null,
      tableId: parsed.data.tableId || null,
      chartType: parsed.data.chartType,
      config: JSON.stringify(parsed.data.config),
      positionX: parsed.data.positionX,
      positionY: parsed.data.positionY,
      width: parsed.data.width,
      height: parsed.data.height,
    },
  });

  return NextResponse.json(widget, { status: 201 });
}
