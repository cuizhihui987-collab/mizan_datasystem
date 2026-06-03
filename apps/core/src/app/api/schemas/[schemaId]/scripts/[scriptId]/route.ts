import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";
import { z } from "zod";

const updateScriptSchema = z.object({
  scriptName: z.string().min(1).max(100).optional(),
  sql: z.string().min(1).optional(),
  description: z.string().max(500).optional(),
});

async function getScript(scriptId: string, userId: string) {
  return prisma.customScript.findFirst({
    where: { id: scriptId, schema: { userId } },
  });
}

// GET /api/schemas/[schemaId]/scripts/[scriptId] — Get a script
export async function GET(
  req: Request,
  { params }: { params: Promise<{ schemaId: string; scriptId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { scriptId } = await params;
  const script = await getScript(scriptId, session.user.id);
  if (!script) {
    return NextResponse.json({ error: "脚本不存在" }, { status: 404 });
  }

  return NextResponse.json(script);
}

// PUT /api/schemas/[schemaId]/scripts/[scriptId] — Update script
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ schemaId: string; scriptId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { scriptId } = await params;

  const existing = await getScript(scriptId, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "脚本不存在" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = updateScriptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "输入无效" },
        { status: 400 }
      );
    }

    const updated = await prisma.customScript.update({
      where: { id: scriptId },
      data: parsed.data,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

// DELETE /api/schemas/[schemaId]/scripts/[scriptId] — Delete script
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ schemaId: string; scriptId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { scriptId } = await params;

  const existing = await getScript(scriptId, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "脚本不存在" }, { status: 404 });
  }

  await prisma.customScript.delete({ where: { id: scriptId } });

  return NextResponse.json({ success: true });
}
