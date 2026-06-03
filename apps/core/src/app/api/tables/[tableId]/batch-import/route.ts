import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";
import { canAccessTable } from "@mizan/shared-lib/auth/permissions";
import { z } from "zod";

const batchImportSchema = z.object({
  keyColumn: z.string().min(1, "请选择匹配字段"),
  rows: z.array(z.record(z.unknown())).min(1, "数据不能为空"),
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
    include: { columns: { orderBy: { ordinalPosition: "asc" } } },
  });

  if (!table || table.status === "DRAFT") {
    return NextResponse.json({ error: "表不可用" }, { status: 400 });
  }

  try {
    if (!(await canAccessTable(tableId, session.user.id, "insert"))) {
      return NextResponse.json({ error: "无权批量导入" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = batchImportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "参数无效" },
        { status: 400 }
      );
    }

    const { keyColumn, rows } = parsed.data;
    const keyColLower = keyColumn.toLowerCase();

    // Build column map — match by both physical and logical names
    const validColumns = table.columns.filter(
      (c) => !["_id", "_created_at", "_updated_at"].includes(c.physicalName)
    );
    const validLowerMap = new Map(
      validColumns.map((c) => [c.physicalName.toLowerCase(), c.physicalName])
    );
    // Also add logical name mappings for easier matching
    for (const col of validColumns) {
      const logicalLower = col.logicalName.toLowerCase().trim();
      if (!validLowerMap.has(logicalLower)) {
        validLowerMap.set(logicalLower, col.physicalName);
      }
    }

    // Find key column in table — search physical names, logical names, and hardcoded keywords
    const tableKeyColumn = [...validColumns].find((c) => {
      const lowerPhys = c.physicalName.toLowerCase();
      const lowerLogi = c.logicalName.toLowerCase().trim();
      return (
        lowerPhys === keyColLower ||
        lowerLogi === keyColLower ||
        lowerPhys === "货号" || lowerLogi === "货号" ||
        lowerPhys === "item_no" || lowerLogi === "item_no" ||
        lowerPhys === "item_number" || lowerLogi === "item_number" ||
        lowerPhys === "product_code" || lowerLogi === "product_code" ||
        lowerPhys === "sku" || lowerLogi === "sku" ||
        lowerPhys === "code" || lowerLogi === "code"
      );
    })?.physicalName;

    if (!tableKeyColumn) {
      return NextResponse.json(
        { error: `表中未找到匹配字段 "${keyColumn}"` },
        { status: 400 }
      );
    }

    // Fetch existing data to build key lookup
    const tableRef = `"${table.physicalName}"`;
    const existingRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM ${tableRef}`
    );
    const existingMap = new Map<string, Record<string, unknown>>();
    for (const row of existingRows) {
      const key = String(row[tableKeyColumn] ?? "").trim().toLowerCase();
      if (key) existingMap.set(key, row);
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawKey = row[keyColumn];
      const keyValue = String(rawKey ?? "").trim();

      if (!keyValue) {
        skipped++;
        if (errors.length < 50) {
          errors.push({ row: i + 1, message: "匹配字段为空" });
        }
        continue;
      }

      // Map incoming column names to actual table column names
      const data: Record<string, unknown> = {};
      for (const [incomingCol, value] of Object.entries(row)) {
        const lowerCol = incomingCol.toLowerCase().trim();
        const actualCol = validLowerMap.get(lowerCol);
        if (actualCol && actualCol !== tableKeyColumn) {
          const colDef = validColumns.find((c) => c.physicalName === actualCol);
          data[actualCol] = coerceValue(value, colDef?.dataType || "STRING");
        }
      }

      const existingKey = keyValue.toLowerCase();
      const existing = existingMap.get(existingKey);

      if (existing) {
        // Update existing row
        const setClauses = Object.entries(data)
          .map(([col, val]) => {
            if (val === null || val === undefined) return `"${col}" = NULL`;
            if (typeof val === "number") return `"${col}" = ${val}`;
            return `"${col}" = '${String(val).replace(/'/g, "''")}'`;
          })
          .join(", ");

        if (setClauses.length > 0) {
          const pkValue = existing["_id"];
          await prisma.$executeRawUnsafe(
            `UPDATE ${tableRef} SET ${setClauses} WHERE "_id" = ${Number(pkValue)}`
          );
          updated++;
        }
      } else {
        // Insert new row
        data[tableKeyColumn] = coerceValue(
          rawKey,
          validColumns.find((c) => c.physicalName === tableKeyColumn)?.dataType || "STRING"
        );

        const cols = Object.keys(data)
          .map((c) => `"${c}"`)
          .join(", ");
        const vals = Object.values(data)
          .map((v) => {
            if (v === null || v === undefined) return "NULL";
            if (typeof v === "number") return String(v);
            return `'${String(v).replace(/'/g, "''")}'`;
          })
          .join(", ");

        await prisma.$executeRawUnsafe(
          `INSERT INTO ${tableRef} (${cols}) VALUES (${vals})`
        );
        inserted++;
      }

      // Yield to event loop periodically
      if (i > 0 && i % 50 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    return NextResponse.json({
      success: true,
      total: rows.length,
      inserted,
      updated,
      skipped,
      errors: errors.slice(0, 50),
    });
  } catch (error) {
    console.error("Batch import error:", error);
    const message =
      error instanceof SyntaxError
        ? "请求数据格式错误"
        : error instanceof Error
        ? error.message
        : "批量导入失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function coerceValue(value: unknown, dataType: string): unknown {
  if (value === "" || value === undefined || value === null) return null;

  switch (dataType) {
    case "INTEGER":
    case "BIGINT": {
      const n = Number(value);
      return isNaN(n) ? String(value) : Math.floor(n);
    }
    case "FLOAT":
    case "DOUBLE": {
      const n = Number(value);
      return isNaN(n) ? String(value) : n;
    }
    case "BOOLEAN": {
      const s = String(value).toLowerCase().trim();
      if (["true", "yes", "1"].includes(s)) return 1;
      if (["false", "no", "0"].includes(s)) return 0;
      return String(value);
    }
    default:
      return String(value);
  }
}
