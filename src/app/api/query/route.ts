import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const querySchema = z.object({
  sql: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = querySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "输入无效" }, { status: 400 });
    }

    const sql = parsed.data.sql.trim();
    const upper = sql.toUpperCase();

    // Only allow SELECT / WITH / EXPLAIN
    if (
      !upper.startsWith("SELECT") &&
      !upper.startsWith("WITH") &&
      !upper.startsWith("EXPLAIN") &&
      !upper.startsWith("PRAGMA") &&
      !upper.startsWith("VALUES")
    ) {
      return NextResponse.json(
        { error: "只允许执行查询语句 (SELECT)" },
        { status: 403 }
      );
    }

    // Block dangerous operations
    const forbidden = [
      /INSERT\s+/i,
      /UPDATE\s+/i,
      /DELETE\s+/i,
      /DROP\s+/i,
      /ALTER\s+/i,
      /CREATE\s+/i,
      /ATTACH\s+/i,
      /DETACH\s+/i,
      /GRANT\s+/i,
      /REVOKE\s+/i,
    ];
    for (const pattern of forbidden) {
      if (pattern.test(sql)) {
        return NextResponse.json(
          { error: "包含不允许的操作" },
          { status: 403 }
        );
      }
    }

    const results = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      sql + ";"
    );

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "查询失败" },
      { status: 500 }
    );
  }
}
