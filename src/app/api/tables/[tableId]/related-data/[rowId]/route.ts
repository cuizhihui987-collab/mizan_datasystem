import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { isAdmin } from "@/lib/auth/permissions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tableId: string; rowId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { tableId, rowId } = await params;

  const table = await prisma.tableDefinition.findFirst({
    where: (await isAdmin(session.user.id))
      ? { id: tableId }
      : { id: tableId, schema: { userId: session.user.id } },
    include: {
      columns: true,
      sourceForeignKeys: {
        include: {
          sourceColumns: { select: { physicalName: true, dataType: true, logicalName: true } },
          referencedTable: { select: { id: true, logicalName: true, physicalName: true, status: true } },
        },
      },
      targetForeignKeys: {
        include: {
          table: { select: { id: true, logicalName: true, physicalName: true, status: true } },
        },
      },
    },
  });

  if (!table) {
    return NextResponse.json({ error: "表不存在" }, { status: 404 });
  }

  // Get the current row
  const sanitizedTable = table.physicalName.replace(/[^a-z0-9_]/gi, "");
  const rowIdSafe = String(rowId).replace(/[^0-9]/g, "");
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "${sanitizedTable}" WHERE "_id" = ${rowIdSafe} LIMIT 1`
  );
  const currentRow = rows[0] || null;

  // Resolve source FKs
  const sourceFKs: Array<{
    constraintName: string;
    referencedTableId: string;
    referencedTableName: string;
    columns: Array<{
      sourceColumn: string;
      sourceValue: unknown;
      refPhysicalName: string;
      refLogicalName: string;
      refData: Record<string, unknown> | null;
    }>;
  }> = [];

  for (const fk of table.sourceForeignKeys) {
    if (fk.referencedTable.status === "DRAFT") continue;
    if (!currentRow) continue;

    const refCols: Array<{
      sourceColumn: string;
      sourceValue: unknown;
      refPhysicalName: string;
      refLogicalName: string;
      refData: Record<string, unknown> | null;
    }> = [];

    for (const sc of fk.sourceColumns) {
      const val = currentRow[sc.physicalName];
      if (val === null || val === undefined) continue;

      // Query the referenced table for matching row
      const refTable = fk.referencedTable.physicalName.replace(/[^a-z0-9_]/gi, "");
      const safeVal = typeof val === "number" ? String(val) : `'${String(val).replace(/'/g, "''")}'`;
      const refRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM "${refTable}" WHERE "_id" = ${safeVal} LIMIT 1`
      );

      refCols.push({
        sourceColumn: sc.physicalName,
        sourceValue: val,
        refPhysicalName: sc.physicalName,
        refLogicalName: sc.logicalName,
        refData: refRows[0] || null,
      });
    }

    if (refCols.length > 0) {
      sourceFKs.push({
        constraintName: fk.constraintName,
        referencedTableId: fk.referencedTable.id,
        referencedTableName: fk.referencedTable.logicalName,
        columns: refCols,
      });
    }
  }

  // Resolve target FKs (count referencing rows)
  const targetFKs: Array<{
    constraintName: string;
    sourceTableId: string;
    sourceTableName: string;
    referencingCount: number;
  }> = [];

  if (currentRow) {
    for (const fk of table.targetForeignKeys) {
      if (fk.table.status === "DRAFT") continue;
      const refTable = fk.table.physicalName.replace(/[^a-z0-9_]/gi, "");
      try {
        const countResult = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT COUNT(*) as cnt FROM "${refTable}" WHERE "_id" = ${rowIdSafe}`
        );
        const count = Number((countResult[0] as Record<string, unknown>)?.cnt || 0);
        if (count > 0) {
          targetFKs.push({
            constraintName: fk.constraintName,
            sourceTableId: fk.table.id,
            sourceTableName: fk.table.logicalName,
            referencingCount: count,
          });
        }
      } catch {
        // table might not exist
      }
    }
  }

  return NextResponse.json({
    rowId,
    currentRow,
    sourceFKs,
    targetFKs,
  });
}
