import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const executeDDLSchema = z.object({
  ddl: z.string().min(1, "DDL 不能为空"),
  physicalName: z.string().min(1),
  columns: z.array(z.any()).optional().default([]),
  indexes: z.array(z.any()).optional().default([]),
  foreignKeys: z.array(z.any()).optional().default([]),
  triggers: z.array(z.any()).optional().default([]),
});

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
    include: { columns: true },
  });

  if (!table) {
    return NextResponse.json({ error: "表不存在" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = executeDDLSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "输入无效" },
        { status: 400 }
      );
    }

    const { ddl, physicalName, columns: newColumns } = parsed.data;

    // Safety checks
    const forbiddenPatterns = [
      /DROP\s+DATABASE/i,
      /ALTER\s+SYSTEM/i,
      /CREATE\s+USER/i,
      /GRANT\s+/i,
      /REVOKE\s+/i,
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(ddl)) {
        return NextResponse.json(
          { error: "DDL 包含禁止的操作" },
          { status: 403 }
        );
      }
    }

    // Check if the physical table exists
    let tableExists = false;
    try {
      const check = await prisma.$queryRawUnsafe<unknown[]>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        physicalName
      );
      tableExists = Array.isArray(check) && check.length > 0;
    } catch {
      tableExists = false;
    }

    if (tableExists) {
      // ── Table exists: try ALTER TABLE ADD COLUMN for new columns only ──
      // Get existing columns from the physical table
      const existingCols = await prisma.$queryRawUnsafe<
        { name: string }[]
      >(`PRAGMA table_info("${physicalName}")`);

      const existingNames = new Set(existingCols.map((c: { name: string }) => c.name));
      const colDefs = newColumns || [];

      // Sort by ordinal position
      colDefs.sort((a: { ordinalPosition: number }, b: { ordinalPosition: number }) => a.ordinalPosition - b.ordinalPosition);

      for (const col of colDefs) {
        if (!col.physicalName || existingNames.has(col.physicalName)) continue;
        // Map type
        let sqlType = "TEXT";
        switch (col.dataType) {
          case "INTEGER":
          case "BIGINT":
            sqlType = "INTEGER"; break;
          case "FLOAT":
          case "DOUBLE":
          case "DECIMAL":
            sqlType = "REAL"; break;
          case "BOOLEAN":
            sqlType = "INTEGER"; break;
          case "DATE":
          case "DATETIME":
            sqlType = "TEXT"; break;
          default:
            sqlType = "TEXT"; break;
        }
        const defaultClause = col.defaultValue ? ` DEFAULT ${col.defaultValue}` : "";
        const notNullClause = col.isNullable ? "" : " NOT NULL";
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "${physicalName}" ADD COLUMN "${col.physicalName}" ${sqlType}${notNullClause}${defaultClause}`
        );
      }

      // Disable DROP+CREATE path — use the ALTER approach
      // Only re-enable if schema type changes require it (handled by user choosing to recreate)
    } else {
      // ── Table doesn't exist: execute full DDL ──
      const statements = ddl
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement + ";");
      }
    }

    // Update table status
    await prisma.tableDefinition.update({
      where: { id: tableId },
      data: { status: "CREATED" },
    });

    // Save column definitions from the DDL designer (not from old DB state)
    // Full replace: delete all existing and create new
    const colDefs = (newColumns || []).filter(
      (c: { logicalName?: string; physicalName?: string }) =>
        c.logicalName || c.physicalName
    );

    if (colDefs.length > 0 || table.columns.length > 0) {
      // Remove old columns that are no longer in the definition
      const incomingPhysNames = new Set(
        colDefs.map((c: { physicalName: string }) => c.physicalName).filter(Boolean)
      );
      for (const oldCol of table.columns) {
        if (!incomingPhysNames.has(oldCol.physicalName)) {
          await prisma.columnDefinition
            .delete({ where: { id: oldCol.id } })
            .catch(() => {});
        }
      }

      // Create or update incoming columns
      for (let i = 0; i < colDefs.length; i++) {
        const col = colDefs[i];
        const physicalName = col.physicalName || `col_${i + 1}`;
        const logicalName = col.logicalName || physicalName;

        // Check if this column already exists in DB by physicalName
        const existing = table.columns.find(
          (c) => c.physicalName === physicalName
        );

        const data = {
          tableId: table.id,
          logicalName,
          physicalName,
          dataType: col.dataType || "STRING",
          dataTypeArgs: col.dataTypeArgs || null,
          isNullable: col.isNullable !== false,
          isPrimaryKey: col.isPrimaryKey === true,
          isUnique: col.isUnique === true,
          defaultValue: col.defaultValue || null,
          autoIncrement: col.autoIncrement === true,
          ordinalPosition: col.ordinalPosition || i + 1,
          checkExpression: col.checkExpression || null,
        };

        if (existing) {
          await prisma.columnDefinition.update({
            where: { id: existing.id },
            data,
          });
        } else {
          await prisma.columnDefinition.create({
            data: { id: col.id || undefined, ...data },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      physicalName,
      message: tableExists ? "表结构已更新，数据已保留" : "表创建成功",
    });
  } catch (error) {
    console.error("DDL execution error:", error);
    const errMsg =
      error instanceof Error ? error.message : "DDL 执行失败";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
