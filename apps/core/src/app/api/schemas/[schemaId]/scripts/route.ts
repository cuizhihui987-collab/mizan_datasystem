import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";
import { z } from "zod";

const createScriptSchema = z.object({
  scriptName: z.string().min(1, "脚本名称不能为空").max(100),
  sql: z.string().min(1, "SQL 不能为空"),
  description: z.string().max(500).optional(),
});

// GET /api/schemas/[schemaId]/scripts — List all scripts
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

  const scripts = await prisma.customScript.findMany({
    where: { schemaId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(scripts);
}

// POST /api/schemas/[schemaId]/scripts — Create a script
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
    const parsed = createScriptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "输入无效" },
        { status: 400 }
      );
    }

    const script = await prisma.customScript.create({
      data: {
        schemaId,
        scriptName: parsed.data.scriptName,
        sql: parsed.data.sql,
        description: parsed.data.description,
      },
    });

    return NextResponse.json(script, { status: 201 });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2002") {
      return NextResponse.json(
        { error: "该模型中已存在同名脚本" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
