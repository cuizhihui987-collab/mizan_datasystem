import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";
import {
  DynamicQueryBuilder,
  type FilterGroup,
} from "@/lib/query/dynamic-query-builder";
import { isAdmin, getReadableColumnsMap, getWritableColumnsMap, canAccessTable, getTablePermission } from "@mizan/shared-lib/auth/permissions";

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
    where: (await isAdmin(session.user.id))
      ? { id: tableId }
      : {
          id: tableId,
          OR: [
            { schema: { userId: session.user.id } },
            { tablePermissions: { some: { userId: session.user.id } } },
          ],
        },
    include: {
      columns: { orderBy: { ordinalPosition: "asc" } },
      sourceForeignKeys: {
        include: {
          sourceColumns: { select: { physicalName: true } },
          referencedTable: { select: { id: true, logicalName: true, physicalName: true } },
        },
      },
      targetForeignKeys: {
        include: {
          table: { select: { id: true, logicalName: true, physicalName: true } },
        },
      },
    },
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
  const globalSearch = searchParams.get("search") || "";
  const filterParam = searchParams.get("filters");

  try {
    // Permission check
    if (!(await canAccessTable(tableId, session.user.id, "select"))) {
      return NextResponse.json({ error: "无权查询该表" }, { status: 403 });
    }

    // Column-level read filter
    const readableMap = await getReadableColumnsMap(tableId, session.user.id);
    const allowedColumns = readableMap === null
      ? undefined
      : table.columns.filter((c) => readableMap[c.physicalName] !== false).map((c) => c.physicalName);

    const queryBuilder = new DynamicQueryBuilder(table.physicalName);
    let filterGroup: FilterGroup | undefined;

    // Parse structured filters if provided
    if (filterParam) {
      try {
        filterGroup = JSON.parse(filterParam) as FilterGroup;
      } catch {
        // ignore parse errors
      }
    }

    // Combine global search with structured filters
    if (globalSearch) {
      // Create a "contains" condition for each user column
      const searchableColumns = table.columns.filter(
        (c) => !["_id", "_created_at", "_updated_at"].includes(c.physicalName)
      );
      const searchConditions = searchableColumns.map((col) => ({
        column: col.physicalName,
        operator: "contains" as const,
        value: globalSearch,
      }));

      if (filterGroup && filterGroup.conditions.length > 0) {
        // Wrap existing filters AND global search (OR across columns)
        filterGroup = {
          logic: "and",
          conditions: filterGroup.conditions,
        };
        // We need to handle this differently — build an additional OR group
        // For simplicity: pass both to the query builder by merging
        // Actually, we need a nested approach: (globalSearch OR clauses) AND (user filters)
        // This is handled via the combined filter logic below
      }

      if (!filterGroup || filterGroup.conditions.length === 0) {
        filterGroup = {
          logic: "or",
          conditions: searchConditions,
        };
      } else {
        // Existing filters AND global search (OR across columns)
        filterGroup = {
          logic: "and",
          conditions: [
            ...filterGroup.conditions,
            ...searchConditions,
          ],
        };
      }
    }

    const { sql, countSql } = queryBuilder.buildSelectQuery({
      page,
      pageSize,
      sort,
      order,
      filters: filterGroup,
      columns: allowedColumns,
    });

    // Execute data and count queries separately (SQLite only returns last result in batch)
    const [rows, countResults] = await Promise.all([
      prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql),
      prisma.$queryRawUnsafe<Record<string, unknown>[]>(countSql),
    ]);
    const totalCount = countResults.length > 0 ? Number((countResults[0] as Record<string, unknown>).total) : 0;

    const visibleColumns = allowedColumns
      ? table.columns.filter((c) => allowedColumns.includes(c.physicalName))
      : table.columns;

    const perm = await getTablePermission(tableId, session.user.id);

    // Build FK info per column
    const fkMap = new Map<string, {
      constraintName: string;
      referencedTableId: string;
      referencedTableName: string;
      referencedPhysicalName: string;
      refColumnPhysicalNames: string[];
    }>();

    for (const fk of table.sourceForeignKeys) {
      const refColPhys = fk.sourceColumns.map((sc) => sc.physicalName);
      for (const colPhys of refColPhys) {
        fkMap.set(colPhys, {
          constraintName: fk.constraintName,
          referencedTableId: fk.referencedTable.id,
          referencedTableName: fk.referencedTable.logicalName,
          referencedPhysicalName: fk.referencedTable.physicalName,
          refColumnPhysicalNames: [],
        });
      }
    }

    // Target FKs (other tables referencing this one)
    const targetFKs = table.targetForeignKeys.map((fk) => ({
      constraintName: fk.constraintName,
      sourceTableId: fk.table.id,
      sourceTableName: fk.table.logicalName,
      sourcePhysicalName: fk.table.physicalName,
    }));

    return NextResponse.json({
      tableName: table.logicalName,
      columns: visibleColumns.map((c) => ({
        logicalName: c.logicalName,
        physicalName: c.physicalName,
        dataType: c.dataType,
        foreignKeyInfo: fkMap.get(c.physicalName) || null,
      })),
      rows,
      total: totalCount,
      page,
      pageSize,
      permissions: {
        isOwner: perm.isOwner,
        canInsert: perm.canInsert,
        canUpdate: perm.canUpdate,
        canDelete: perm.canDelete,
      },
      targetForeignKeys: targetFKs,
    });
  } catch (error) {
    console.error("Query error:", error);
    const errMsg = error instanceof Error ? error.message : "";
    // Handle missing physical table (dropped by db push, etc.)
    if (errMsg.includes("no such table")) {
      // Auto-revert status to DRAFT so UI shows the re-execute prompt
      await prisma.tableDefinition
        .update({ where: { id: tableId }, data: { status: "DRAFT" } })
        .catch(() => {});
      return NextResponse.json(
        { error: "物理表不存在，请重新执行 DDL 建表", needsReexecution: true },
        { status: 400 }
      );
    }
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
    where: (await isAdmin(session.user.id))
      ? { id: tableId }
      : {
          id: tableId,
          OR: [
            { schema: { userId: session.user.id } },
            { tablePermissions: { some: { userId: session.user.id } } },
          ],
        },
  });

  if (!table || table.status === "DRAFT") {
    return NextResponse.json({ error: "表不可用" }, { status: 400 });
  }

  try {
    if (!(await canAccessTable(tableId, session.user.id, "insert"))) {
      return NextResponse.json({ error: "无权插入数据" }, { status: 403 });
    }

    const body = await req.json();

    // Filter to writable columns only
    const writableMap = await getWritableColumnsMap(tableId, session.user.id);
    const filteredBody = writableMap === null
      ? body
      : Object.fromEntries(
          Object.entries(body).filter(([key]) => writableMap[key] !== false)
        );

    const queryBuilder = new DynamicQueryBuilder(table.physicalName);
    const { sql } = queryBuilder.buildInsertQuery(filteredBody);

    await prisma.$executeRawUnsafe(sql);

    return NextResponse.json({ success: true });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "";
    if (errMsg.includes("no such table")) {
      await prisma.tableDefinition.update({ where: { id: tableId }, data: { status: "DRAFT" } }).catch(() => {});
      return NextResponse.json({ error: "物理表不存在，请重新执行 DDL 建表" }, { status: 400 });
    }
    return NextResponse.json(
      { error: errMsg || "插入失败" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { tableId } = await params;

  const table = await prisma.tableDefinition.findFirst({
    where: (await isAdmin(session.user.id))
      ? { id: tableId }
      : {
          id: tableId,
          OR: [
            { schema: { userId: session.user.id } },
            { tablePermissions: { some: { userId: session.user.id } } },
          ],
        },
  });

  if (!table || table.status === "DRAFT") {
    return NextResponse.json({ error: "表不可用" }, { status: 400 });
  }

  try {
    if (!(await canAccessTable(tableId, session.user.id, "update"))) {
      return NextResponse.json({ error: "无权更新数据" }, { status: 403 });
    }

    const body = await req.json();
    const queryBuilder = new DynamicQueryBuilder(table.physicalName);

    // Batch update: { ids: number[], column: string, value: unknown }
    if (body.ids && body.column) {
      const ids = (body.ids as (number | string)[]).map(Number);
      const sanitizedCol = body.column.replace(/[^a-z0-9_一-鿿]/gi, "");
      if (!sanitizedCol) {
        return NextResponse.json({ error: "无效的字段名" }, { status: 400 });
      }
      const placeholders = ids.map(() => "?").join(", ");

      let valSql: string;
      const val = body.value;
      if (val === null || val === undefined) {
        valSql = "NULL";
      } else if (typeof val === "number") {
        valSql = String(val);
      } else {
        valSql = `'${String(val).replace(/'/g, "''")}'`;
      }

      const sql = `UPDATE "${table.physicalName}" SET "${sanitizedCol}" = ${valSql} WHERE "_id" IN (${placeholders})`;
      await prisma.$executeRawUnsafe(sql, ...ids);

      return NextResponse.json({ success: true, updated: ids.length });
    }

    // Single row update: { _id, ...data }
    if (!body._id) {
      return NextResponse.json({ error: "缺少 _id" }, { status: 400 });
    }

    const { _id, ...data } = body;
    const { sql } = queryBuilder.buildUpdateQuery(_id, data);
    await prisma.$executeRawUnsafe(sql);

    return NextResponse.json({ success: true });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "";
    if (errMsg.includes("no such table")) {
      await prisma.tableDefinition.update({ where: { id: tableId }, data: { status: "DRAFT" } }).catch(() => {});
      return NextResponse.json({ error: "物理表不存在，请重新执行 DDL 建表" }, { status: 400 });
    }
    return NextResponse.json(
      { error: errMsg || "更新失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { tableId } = await params;

  const table = await prisma.tableDefinition.findFirst({
    where: (await isAdmin(session.user.id))
      ? { id: tableId }
      : {
          id: tableId,
          OR: [
            { schema: { userId: session.user.id } },
            { tablePermissions: { some: { userId: session.user.id } } },
          ],
        },
  });

  if (!table || table.status === "DRAFT") {
    return NextResponse.json({ error: "表不可用" }, { status: 400 });
  }

  try {
    if (!(await canAccessTable(tableId, session.user.id, "delete"))) {
      return NextResponse.json({ error: "无权删除数据" }, { status: 403 });
    }

    const body = await req.json();

    // Batch delete: { ids: number[] }
    if (body.ids && Array.isArray(body.ids)) {
      const ids = body.ids.map(Number);
      const placeholders = ids.map(() => "?").join(", ");
      const sql = `DELETE FROM "${table.physicalName}" WHERE "_id" IN (${placeholders})`;
      await prisma.$executeRawUnsafe(sql, ...ids);
      return NextResponse.json({ success: true, deleted: ids.length });
    }

    // Single delete: { _id }
    if (!body._id) {
      return NextResponse.json({ error: "缺少 _id" }, { status: 400 });
    }

    const queryBuilder = new DynamicQueryBuilder(table.physicalName);
    const { sql } = queryBuilder.buildDeleteQuery(body._id);
    await prisma.$executeRawUnsafe(sql);

    return NextResponse.json({ success: true });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "";
    if (errMsg.includes("no such table")) {
      await prisma.tableDefinition.update({ where: { id: tableId }, data: { status: "DRAFT" } }).catch(() => {});
      return NextResponse.json({ error: "物理表不存在，请重新执行 DDL 建表" }, { status: 400 });
    }
    return NextResponse.json(
      { error: errMsg || "删除失败" },
      { status: 500 }
    );
  }
}
