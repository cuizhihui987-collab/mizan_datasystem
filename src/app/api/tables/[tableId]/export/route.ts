import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { canAccessTable, getReadableColumnsMap } from "@/lib/auth/permissions";
import * as XLSX from "xlsx";

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

  if (!table || table.status === "DRAFT") {
    return NextResponse.json({ error: "表不可用" }, { status: 400 });
  }

  if (!(await canAccessTable(tableId, session.user.id, "select"))) {
    return NextResponse.json({ error: "无权导出该表" }, { status: 403 });
  }

  // Column-level read filter
  const readableMap = await getReadableColumnsMap(tableId, session.user.id);
  const userColumns = table.columns.filter(
    (c) => !["_id", "_created_at", "_updated_at"].includes(c.physicalName)
  );
  const visibleColumns = readableMap === null
    ? userColumns
    : userColumns.filter((c) => readableMap[c.physicalName] !== false);

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "xlsx";

  try {
    // Query all rows
    const allRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "${table.physicalName}" ORDER BY "_id" ASC`
    );

    // Build header row with logical names
    const headers = visibleColumns.map((c) => c.logicalName);

    // Map data rows: use logical names as keys
    const exportData = allRows.map((row) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: Record<string, any> = {};
      for (const col of visibleColumns) {
        const val = row[col.physicalName];
        if (col.dataType === "BOOLEAN") {
          mapped[col.logicalName] =
            val === 0 || val === "0" || val === false ? "否" : "是";
        } else if (val === null || val === undefined) {
          mapped[col.logicalName] = "";
        } else {
          mapped[col.logicalName] = val;
        }
      }
      return mapped;
    });

    if (format === "csv") {
      // Generate CSV manually (xlsx csv output can have encoding issues)
      const csvEscape = (v: string) => {
        if (v.includes(",") || v.includes('"') || v.includes("\n")) {
          return `"${v.replace(/"/g, '""')}"`;
        }
        return v;
      };

      const csvLines: string[] = [];
      csvLines.push(headers.map((h) => csvEscape(h)).join(","));
      for (const row of exportData) {
        csvLines.push(
          headers.map((h) => csvEscape(String(row[h] ?? ""))).join(",")
        );
      }

      const bom = "﻿";
      const csvContent = bom + csvLines.join("\r\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="export.csv"; filename*=UTF-8''${encodeURIComponent(table.logicalName)}.csv`,
        },
      });
    }

    // Generate Excel
    const ws = XLSX.utils.json_to_sheet(exportData, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    // Auto-size column widths
    const colWidths = headers.map((h, idx) => {
      let maxLen = h.length;
      for (const row of exportData) {
        const val = String(row[headers[idx]] ?? "");
        if (val.length > maxLen) maxLen = val.length;
      }
      return { wch: Math.min(maxLen + 2, 60) };
    });
  ws["!cols"] = colWidths;

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(table.logicalName)}.xlsx`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导出失败" },
      { status: 500 }
    );
  }
}
