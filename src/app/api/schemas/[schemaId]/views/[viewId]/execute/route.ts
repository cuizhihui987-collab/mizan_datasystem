import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";

// POST /api/schemas/[schemaId]/views/[viewId]/execute — Execute (create) the view
export async function POST(
  req: Request,
  { params }: { params: Promise<{ schemaId: string; viewId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { viewId } = await params;

  const view = await prisma.viewDefinition.findFirst({
    where: { id: viewId, schema: { userId: session.user.id } },
  });

  if (!view) {
    return NextResponse.json({ error: "视图不存在" }, { status: 404 });
  }

  // Safety: only allow CREATE VIEW + SELECT
  const sql = view.sql.trim();
  const upper = sql.toUpperCase();
  if (
    !upper.startsWith("SELECT") &&
    !upper.startsWith("WITH") &&
    !upper.startsWith("VALUES")
  ) {
    return NextResponse.json(
      { error: "视图 SQL 只能包含 SELECT 查询" },
      { status: 403 }
    );
  }

  const forbidden = [
    /DROP\s+/i,
    /ALTER\s+/i,
    /INSERT\s+/i,
    /UPDATE\s+/i,
    /DELETE\s+/i,
    /CREATE\s+/i,
    /PRAGMA\s+/i,
    /ATTACH\s+/i,
    /DETACH\s+/i,
    /VACUUM\s+/i,
    /REINDEX\s+/i,
  ];

  for (const pattern of forbidden) {
    if (pattern.test(sql)) {
      return NextResponse.json(
        { error: "视图 SQL 包含不允许的操作" },
        { status: 403 }
      );
    }
  }

  try {
    // Drop existing view first for idempotency
    await prisma.$executeRawUnsafe(
      `DROP VIEW IF EXISTS "${view.viewName}"`
    );

    await prisma.$executeRawUnsafe(
      `CREATE VIEW "${view.viewName}" AS ${sql}`
    );

    // Update status
    await prisma.viewDefinition.update({
      where: { id: viewId },
      data: { status: "CREATED" },
    });

    return NextResponse.json({
      success: true,
      message: `视图 "${view.viewName}" 创建成功`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "视图创建失败" },
      { status: 500 }
    );
  }
}
