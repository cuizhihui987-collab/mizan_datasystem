import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";

// POST /api/schemas/[schemaId]/scripts/[scriptId]/execute — Execute the script
export async function POST(
  req: Request,
  { params }: { params: Promise<{ schemaId: string; scriptId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { scriptId } = await params;

  const script = await prisma.customScript.findFirst({
    where: { id: scriptId, schema: { userId: session.user.id } },
  });

  if (!script) {
    return NextResponse.json({ error: "脚本不存在" }, { status: 404 });
  }

  // Safety: block dangerous operations
  const forbidden = [
    /DROP\s+DATABASE/i,
    /CREATE\s+USER/i,
    /GRANT\s+/i,
    /REVOKE\s+/i,
    /ATTACH\s+/i,
    /DETACH\s+/i,
  ];

  for (const pattern of forbidden) {
    if (pattern.test(script.sql)) {
      return NextResponse.json(
        { error: "脚本包含禁止的操作" },
        { status: 403 }
      );
    }
  }

  try {
    const statements = script.sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let affectedRows = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let results: any[] | null = null;

    for (const statement of statements) {
      const upper = statement.toUpperCase();

      if (upper.startsWith("SELECT") || upper.startsWith("WITH")) {
        // Query
        const data = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
          statement + ";"
        );
        if (!results) results = [];
        results = results.concat(data);
      } else if (
        upper.startsWith("INSERT") ||
        upper.startsWith("UPDATE") ||
        upper.startsWith("DELETE")
      ) {
        // Mutation
        const result = await prisma.$executeRawUnsafe(statement + ";");
        affectedRows += result || 0;
      } else {
        // Other DDL
        await prisma.$executeRawUnsafe(statement + ";");
      }
    }

    return NextResponse.json({
      success: true,
      message: `脚本执行完成`,
      affectedRows,
      resultCount: results?.length || 0,
      results: results?.slice(0, 100) || null, // Limit results to 100 rows
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "脚本执行失败" },
      { status: 500 }
    );
  }
}
