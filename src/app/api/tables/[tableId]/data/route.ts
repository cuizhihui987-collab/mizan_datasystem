import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { DynamicQueryBuilder } from "@/lib/query/dynamic-query-builder";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { tableId } = await params;

  const table = await prisma.tableDefinition.findFirst({
    where: { id: tableId, schema: { userId: session.user.id } },
    include: { columns: { orderBy: { ordinalPosition: "asc" } } },
  });

  if (!table) {
    return NextResponse.json({ error: "表不存在" }, { status: 404 });
  }

  if (table.status === "DRAFT") {
    return NextResponse.json(
      { error: "表尚未创建，请先在 DDL 设计器中执行建表" },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "50");
  const sort = searchParams.get("sort") || undefined;
  const order = (searchParams.get("order") || "asc") as "asc" | "desc";
  const filterParam = searchParams.get("filters");

  try {
    const queryBuilder = new DynamicQueryBuilder(table.physicalName);
    const filters = filterParam ? JSON.parse(filterParam) : undefined;

    const { sql } = queryBuilder.buildSelectQuery({
      page,
      pageSize,
      sort,
      order,
      filters,
    });

    // Execute both queries as a batch
    const results = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql);

    // The last result is the COUNT
    const total = results.length > 0 ? (results[0] as unknown as { total: number }).total || 0 : 0;

    // First result is the data
    // Actually, with $queryRawUnsafe we get one result set
    // For SQLite batch queries, we need to handle this differently
    const rows = results.filter((r) => r && typeof r === "object" && "total" in r === false);
    const countResult = results.find((r) => r && typeof r === "object" && "total" in r);
    const totalCount = countResult ? Number((countResult as Record<string, unknown>).total) : 0;

    return NextResponse.json({
      columns: table.columns.map((c) => ({
        logicalName: c.logicalName,
        physicalName: c.physicalName,
        dataType: c.dataType,
      })),
      rows: rows.length > 0 ? rows : results,
      total: totalCount,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Query error:", error);
    return NextResponse.json(
      { error: "查询失败，表结构可能已变更" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { tableId } = await params;

  const table = await prisma.tableDefinition.findFirst({
    where: { id: tableId, schema: { userId: session.user.id } },
  });

  if (!table || table.status === "DRAFT") {
    return NextResponse.json({ error: "表不可用" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const queryBuilder = new DynamicQueryBuilder(table.physicalName);
    const { sql } = queryBuilder.buildInsertQuery(body);

    await prisma.$executeRawUnsafe(sql);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "插入失败" },
      { status: 500 }
    );
  }
}
