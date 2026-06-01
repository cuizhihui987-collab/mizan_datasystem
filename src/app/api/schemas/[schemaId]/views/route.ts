import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const createViewSchema = z.object({
  viewName: z.string().min(1, "视图名称不能为空").max(100),
  sql: z.string().min(1, "SQL 不能为空"),
  description: z.string().max(500).optional(),
});

// GET /api/schemas/[schemaId]/views — List all views
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

  const views = await prisma.viewDefinition.findMany({
    where: { schemaId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(views);
}

// POST /api/schemas/[schemaId]/views — Create a view
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
    const parsed = createViewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "输入无效" },
        { status: 400 }
      );
    }

    const view = await prisma.viewDefinition.create({
      data: {
        schemaId,
        viewName: parsed.data.viewName,
        sql: parsed.data.sql,
        description: parsed.data.description,
      },
    });

    return NextResponse.json(view, { status: 201 });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2002") {
      return NextResponse.json(
        { error: "该模型中已存在同名视图" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
