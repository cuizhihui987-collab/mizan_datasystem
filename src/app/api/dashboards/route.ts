import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100),
  schemaId: z.string().min(1, "请选择数据模型"),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const dashboards = await prisma.dashboard.findMany({
    where: { schema: { userId: session.user.id } },
    orderBy: { updatedAt: "desc" },
    include: {
      schema: { select: { name: true } },
      _count: { select: { widgets: true } },
    },
  });

  return NextResponse.json(dashboards);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "参数错误" },
      { status: 400 }
    );
  }

  const schema = await prisma.schema.findFirst({
    where: { id: parsed.data.schemaId, userId: session.user.id },
  });
  if (!schema) {
    return NextResponse.json({ error: "数据模型不存在" }, { status: 404 });
  }

  const dashboard = await prisma.dashboard.create({
    data: {
      schemaId: parsed.data.schemaId,
      name: parsed.data.name,
    },
  });

  return NextResponse.json(dashboard, { status: 201 });
}
