import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import ExcelJS from "exceljs";

interface FilterCond {
  column: string;
  operator: string;
  value: string;
}

function buildWhereClause(filters?: FilterCond[]): string {
  if (!filters || filters.length === 0) return "";
  const clauses = filters
    .map((f) => {
      const col = f.column.replace(/[^a-z0-9_一-鿿]/gi, "");
      if (!col) return null;
      const qc = `"${col}"`;
      switch (f.operator) {
        case "eq":
          return `${qc} = '${String(f.value).replace(/'/g, "''")}'`;
        case "neq":
          return `${qc} != '${String(f.value).replace(/'/g, "''")}'`;
        case "contains":
          return `${qc} LIKE '%${String(f.value).replace(/'/g, "''")}%'`;
        case "gt":
          return `${qc} > '${String(f.value).replace(/'/g, "''")}'`;
        case "gte":
          return `${qc} >= '${String(f.value).replace(/'/g, "''")}'`;
        case "lt":
          return `${qc} < '${String(f.value).replace(/'/g, "''")}'`;
        case "lte":
          return `${qc} <= '${String(f.value).replace(/'/g, "''")}'`;
        case "startsWith":
          return `${qc} LIKE '${String(f.value).replace(/'/g, "''")}%'`;
        case "endsWith":
          return `${qc} LIKE '%${String(f.value).replace(/'/g, "''")}'`;
        case "isEmpty":
          return `(${qc} IS NULL OR ${qc} = '')`;
        case "isNotEmpty":
          return `(${qc} IS NOT NULL AND ${qc} != '')`;
        default:
          return null;
      }
    })
    .filter(Boolean);

  return clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ schemaId: string; templateId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { templateId, schemaId } = await params;

  let body: { tableId?: string; filters?: FilterCond[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求数据" }, { status: 400 });
  }

  const tableId = body.tableId;
  if (!tableId) {
    return NextResponse.json({ error: "请选择要导出的数据表" }, { status: 400 });
  }

  // Verify template ownership
  const template = await prisma.exportTemplate.findFirst({
    where: { id: templateId, schema: { userId: session.user.id } },
  });
  if (!template) {
    return NextResponse.json({ error: "模板不存在" }, { status: 404 });
  }

  // Verify table ownership
  const table = await prisma.tableDefinition.findFirst({
    where: { id: tableId, schema: { userId: session.user.id } },
    include: { columns: { orderBy: { ordinalPosition: "asc" } } },
  });
  if (!table || table.status === "DRAFT") {
    return NextResponse.json({ error: "表不可用" }, { status: 400 });
  }

  // Get schema name for file pattern
  const schema = await prisma.schema.findUnique({ where: { id: schemaId } });

  try {
    const config = JSON.parse(template.config);
    const format = config.format || "xlsx";

    // Query data with optional filters
    const whereClause = buildWhereClause(body.filters);
    const allRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "${table.physicalName}" ${whereClause} ORDER BY "_id" ASC`
    );

    // Determine columns
    const userColumns = table.columns.filter(
      (c) => !["_id", "_created_at", "_updated_at"].includes(c.physicalName)
    );

    const templateCols: Array<{
      physicalName: string;
      headerName: string;
      width: number;
      selected: boolean;
    }> = config.columns || [];

    const exportCols =
      templateCols.length > 0
        ? templateCols.filter((c) => c.selected !== false)
        : userColumns.map((c) => ({
            physicalName: c.physicalName,
            headerName: c.logicalName,
            width: 20,
            selected: true,
          }));

    const headerPosition = config.headerPosition || "top";
    const sheetName = config.sheetName || "Sheet1";

    // Build file name from pattern — support {col:physicalName} for column values
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const datetimeStr = now
      .toISOString()
      .slice(0, 19)
      .replace(/[:]/g, "")
      .replace("T", "_");

    let fileName = (config.filePattern || "{tableName}_{date}")
      .replace(/{tableName}/g, table.logicalName)
      .replace(/{date}/g, dateStr)
      .replace(/{datetime}/g, datetimeStr)
      .replace(/{schemaName}/g, schema?.name || "export");

    // Resolve {col:xxx} — match by physical name first, then logical name
    const colNameMap = new Map<string, string>();
    for (const c of userColumns) {
      colNameMap.set(c.physicalName.toLowerCase(), c.physicalName);
      colNameMap.set(c.logicalName.toLowerCase(), c.physicalName);
    }
    if (allRows.length > 0) {
      const firstRow = allRows[0];
      fileName = fileName.replace(/\{col:([^}]+)\}/g, (_m: string, raw: string) => {
        const key = raw.trim().toLowerCase();
        const physName = colNameMap.get(key);
        if (physName && physName in firstRow) {
          const val = firstRow[physName];
          if (val === null || val === undefined) return "_";
          return String(val).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 50);
        }
        // Try direct key match
        if (key in firstRow) {
          const val = firstRow[key];
          if (val === null || val === undefined) return "_";
          return String(val).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 50);
        }
        return "_";
      });
    } else {
      // No rows — remove col references
      fileName = fileName.replace(/\{col:[^}]+\}/g, "_");
    }

    // Build data rows
    const dataRowStyle = {
      font: { size: 10 } as const,
      alignment: { vertical: "middle" as const, wrapText: true as const },
    };

    if (format === "csv") {
      // Simple CSV — no image/styling support
      const headers = exportCols.map((c) => c.headerName);
      const exportData = allRows.map((row) => {
        const mapped: Record<string, unknown> = {};
        for (const col of exportCols) {
          const val = row[col.physicalName];
          const colDef = userColumns.find(
            (c) => c.physicalName === col.physicalName
          );
          if (colDef?.dataType === "BOOLEAN") {
            mapped[col.headerName] =
              val === 0 || val === "0" || val === false ? "否" : "是";
          } else if (val === null || val === undefined) {
            mapped[col.headerName] = "";
          } else {
            mapped[col.headerName] = val;
          }
        }
        return mapped;
      });

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
      return new NextResponse(bom + csvLines.join("\r\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="export.csv"; filename*=UTF-8''${encodeURIComponent(fileName)}.csv`,
        },
      });
    }

    // ─── Excel (xlsx) with exceljs ───
    const wb = new ExcelJS.Workbook();
    wb.creator = "Mizan 数据管理系统";
    wb.created = now;
    const ws = wb.addWorksheet(sheetName);

    // Style definitions
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 11, color: { argb: "FFFFFFFF" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F81BD" } },
      alignment: {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    };

    // ── Logo image ──
    let logoRowOffset = 0;
    if (config.logoImage) {
      const base64Data = config.logoImage.replace(/^data:image\/\w+;base64,/, "");
      const imageId = wb.addImage({
        base64: base64Data,
        extension: config.logoImage.includes("image/png") ? "png" : "jpeg",
      });

      const logoWidth = config.logoWidth || 200;
      const logoHeight = config.logoHeight || 60;

      ws.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: logoWidth, height: logoHeight },
      });

      logoRowOffset = Math.ceil(logoHeight / 20) + 1; // ~20px per row
    }

    // ── Header Position: top (default) ──
    if (headerPosition === "top") {
      // Headers in first data row (after logo)
      const headerRow = logoRowOffset + 1;
      const headerCells = exportCols.map((c) => c.headerName);
      const hRow = ws.getRow(headerRow);
      headerCells.forEach((h, i) => {
        const cell = hRow.getCell(i + 1);
        cell.value = h;
        cell.style = headerStyle;
      });
      hRow.height = 25;

      // Set column widths
      exportCols.forEach((c, i) => {
        ws.getColumn(i + 1).width = Math.min(Math.max(c.width || 20, 8), 60);
      });

      // Data rows
      allRows.forEach((row, ri) => {
        const r = ws.getRow(headerRow + 1 + ri);
        exportCols.forEach((col, ci) => {
          const cell = r.getCell(ci + 1);
          const val = row[col.physicalName];
          const colDef = userColumns.find(
            (c) => c.physicalName === col.physicalName
          );
          if (colDef?.dataType === "BOOLEAN") {
            cell.value =
              val === 0 || val === "0" || val === false ? "否" : "是";
          } else if (val === null || val === undefined) {
            cell.value = "";
          } else if (["INTEGER", "BIGINT"].includes(colDef?.dataType || "")) {
            cell.value = Number(val);
            cell.numFmt = "0";
          } else if (
            ["FLOAT", "DOUBLE", "DECIMAL"].includes(colDef?.dataType || "")
          ) {
            cell.value = Number(val);
            cell.numFmt = "#,##0.00";
          } else {
            cell.value = String(val);
          }
          cell.style = dataRowStyle;
        });
        r.height = 20;
      });

      // Auto-filter
      if (allRows.length > 0) {
        ws.autoFilter = {
          from: { row: headerRow, column: 1 },
          to: {
            row: headerRow,
            column: exportCols.length,
          },
        };
      }
    } else {
      // ── Header Position: left ──
      // First column is headers, rest are data rows
      const startRow = logoRowOffset + 1;

      // Set first column width for headers
      ws.getColumn(1).width = Math.max(
        ...exportCols.map((c) => Math.min(c.headerName.length + 4, 40))
      );

      exportCols.forEach((col, ci) => {
        // Data column width
        const dataColIdx = ci + 2;
        ws.getColumn(dataColIdx).width = Math.min(
          Math.max(col.width || 20, 8),
          60
        );
      });

      exportCols.forEach((col, ci) => {
        const labelRow = ws.getRow(startRow + ci);
        const labelCell = labelRow.getCell(1);
        labelCell.value = col.headerName;
        labelCell.style = headerStyle;

        const dataColIdx = ci + 2;
        allRows.forEach((row, ri) => {
          const r = ws.getRow(startRow + ri);
          const cell = r.getCell(dataColIdx);
          const val = row[col.physicalName];
          const colDef = userColumns.find(
            (c) => c.physicalName === col.physicalName
          );
          if (colDef?.dataType === "BOOLEAN") {
            cell.value =
              val === 0 || val === "0" || val === false ? "否" : "是";
          } else if (val === null || val === undefined) {
            cell.value = "";
          } else if (["INTEGER", "BIGINT"].includes(colDef?.dataType || "")) {
            cell.value = Number(val);
          } else if (
            ["FLOAT", "DOUBLE", "DECIMAL"].includes(colDef?.dataType || "")
          ) {
            cell.value = Number(val);
          } else {
            cell.value = String(val);
          }
          cell.style = dataRowStyle;
        });
      });
    }

    // ── Write buffer ──
    const rawBuffer = await wb.xlsx.writeBuffer();
    const buffer = Buffer.from(rawBuffer);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}.xlsx`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导出失败" },
      { status: 500 }
    );
  }
}
