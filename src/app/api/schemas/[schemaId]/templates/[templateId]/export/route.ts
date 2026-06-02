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

// ─── Image helpers ──────────────────────────────────────

const IMAGE_EXT_MAP: Record<string, "png" | "jpeg" | "gif"> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/gif": "gif",
};

function isImageUrl(val: unknown): boolean {
  if (typeof val !== "string") return false;
  const trimmed = val.trim().toLowerCase();
  return (
    (trimmed.startsWith("http://") || trimmed.startsWith("https://")) &&
    /\.(png|jpe?g|gif|webp)(\?.*)?$/.test(trimmed)
  );
}

async function downloadImage(url: string): Promise<{ buffer: Uint8Array; ext: "png" | "jpeg" | "gif" } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mizan-Export/1.0" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "";
    const ext = IMAGE_EXT_MAP[contentType] || "";
    if (!ext) return null;

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > 5 * 1024 * 1024) return null; // skip images > 5MB
    return { buffer: new Uint8Array(buffer), ext };
  } catch {
    return null;
  }
}

// ─── Computed column helpers ────────────────────────────

/** Convert 1-based column index to Excel column letter (1=A, 2=B, ...) */
function colLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n > 0) {
    n--;
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26);
  }
  return letter;
}

/** Build a header-name → column-letter map from export columns */
function buildHeaderColMap(exportCols: { headerName: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  exportCols.forEach((col, idx) => {
    map.set(col.headerName, colLetter(idx + 1));
  });
  return map;
}

/** Resolve a computed column expression into an Excel formula for the given row number */
function resolveExpression(
  expression: string,
  headerColMap: Map<string, string>,
  rowNum: number
): string {
  const resolved = expression.replace(/\{([^}]+)\}/g, (_m: string, colName: string) => {
    const letter = headerColMap.get(colName.trim());
    if (letter) return `${letter}${rowNum}`;
    return `{${colName}}`; // leave unresolved
  });
  return `=${resolved}`;
}

// ─── Main handler ───────────────────────────────────────

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

  const schema = await prisma.schema.findUnique({ where: { id: schemaId } });

  try {
    const config = JSON.parse(template.config);
    const format = config.format || "xlsx";

    // Query data
    const whereClause = buildWhereClause(body.filters);
    const allRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "${table.physicalName}" ${whereClause} ORDER BY "_id" ASC`
    );

    // Determine export columns
    const userColumns = table.columns.filter(
      (c) => !["_id", "_created_at", "_updated_at"].includes(c.physicalName)
    );

    const templateCols: Array<{
      physicalName: string;
      headerName: string;
      width: number;
      selected: boolean;
      isImage?: boolean;
    }> = config.columns || [];

    const exportCols =
      templateCols.length > 0
        ? templateCols.filter((c) => c.selected !== false)
        : userColumns.map((c) => ({
            physicalName: c.physicalName,
            headerName: c.logicalName,
            width: 20,
            selected: true,
            isImage: false,
          }));

    // Computed columns
    const computedCols: Array<{
      headerName: string;
      expression: string;
      width: number;
    }> = config.computedColumns || [];

    const staticCols: Array<{ headerName: string; value: string; width: number }> =
      config.customStaticColumns || [];

    const headerPosition = config.headerPosition || "top";
    const sheetName = config.sheetName || "Sheet1";

    // Build file name from pattern
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
        if (key in firstRow) {
          const val = firstRow[key];
          if (val === null || val === undefined) return "_";
          return String(val).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 50);
        }
        return "_";
      });
    } else {
      fileName = fileName.replace(/\{col:[^}]+\}/g, "_");
    }

    const cfgRowHeight = config.rowHeight || 20;
    const cfgFontSize = config.fontSize || 10;
    const cfgHeaderFontSize = config.headerFontSize || 11;
    const cfgHeaderBg = config.headerBgColor || "FF4F81BD";
    const cfgHeaderColor = config.headerFontColor || "FFFFFFFF";
    const cfgImgWidth = config.imageWidth || 100;
    const cfgImgHeight = config.imageHeight || 50;
    const cfgHAlign = config.horizontalAlign || "left";
    const cfgVAlign = config.verticalAlign || "middle";
    const cfgWrapText = config.wrapText !== false;
    const cfgMergeCells: string[] = config.mergedCells || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataRowStyle: any = {
      font: { size: cfgFontSize },
      alignment: { horizontal: cfgHAlign, vertical: cfgVAlign, wrapText: cfgWrapText },
    };

    // ─── CSV export ──────────────────────────────────────
    if (format === "csv") {
      const allExportCols = [
        ...exportCols,
        ...computedCols.map((c) => ({
          physicalName: "",
          headerName: c.headerName,
          width: c.width,
          selected: true,
          isImage: false,
        })),
        ...staticCols.map((sc) => ({
          physicalName: "",
          headerName: sc.headerName,
          width: sc.width,
          selected: true,
          isImage: false,
        })),
      ];
      const headers = allExportCols.map((c) => c.headerName);
      const exportData = allRows.map((row) => {
        const mapped: Record<string, unknown> = {};
        for (const col of exportCols) {
          const val = row[col.physicalName];
          const colDef = userColumns.find((c) => c.physicalName === col.physicalName);
          if (colDef?.dataType === "BOOLEAN") {
            mapped[col.headerName] = val === 0 || val === "0" || val === false ? "否" : "是";
          } else if (val === null || val === undefined) {
            mapped[col.headerName] = "";
          } else {
            mapped[col.headerName] = val;
          }
        }
        // Computed columns in CSV — just leave empty (CSV can't hold formulas)
        for (const cc of computedCols) {
          mapped[cc.headerName] = "";
        }
        // Static columns in CSV
        for (const sc of staticCols) {
          mapped[sc.headerName] = sc.value || "";
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
        csvLines.push(headers.map((h) => csvEscape(String(row[h] ?? ""))).join(","));
      }

      const bom = "﻿";
      return new NextResponse(bom + csvLines.join("\r\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="export.csv"; filename*=UTF-8''${encodeURIComponent(fileName)}.csv`,
        },
      });
    }

    // ─── Excel (xlsx) with exceljs ───────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = "Mizan 数据管理系统";
    wb.created = now;
    const ws = wb.addWorksheet(sheetName);

    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: cfgHeaderFontSize, color: { argb: cfgHeaderColor } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: cfgHeaderBg } },
      alignment: { horizontal: "center", vertical: "middle", wrapText: true },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    };

    // Logo image
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
      logoRowOffset = Math.ceil(logoHeight / 20) + 1;
    }

    // Total column count
    const totalColCount = exportCols.length + computedCols.length + staticCols.length;

    // ── Header Position: top ──
    if (headerPosition === "top") {
      const headerRow = logoRowOffset + 1;

      // Data column headers
      const hRow = ws.getRow(headerRow);
      exportCols.forEach((c, i) => {
        const cell = hRow.getCell(i + 1);
        cell.value = c.headerName;
        cell.style = headerStyle;
      });
      // Computed column headers
      computedCols.forEach((cc, i) => {
        const cell = hRow.getCell(exportCols.length + i + 1);
        cell.value = cc.headerName;
        cell.style = headerStyle;
      });
      // Static column headers
      staticCols.forEach((sc, i) => {
        const cell = hRow.getCell(exportCols.length + computedCols.length + i + 1);
        cell.value = sc.headerName;
        cell.style = headerStyle;
      });
      hRow.height = 25;

      // Set column widths — data columns
      exportCols.forEach((c, i) => {
        ws.getColumn(i + 1).width = Math.min(Math.max(c.width || 20, 8), 60);
      });
      // Computed column widths
      computedCols.forEach((cc, i) => {
        ws.getColumn(exportCols.length + i + 1).width = Math.min(Math.max(cc.width || 20, 8), 60);
      });
      // Static column widths
      staticCols.forEach((sc, i) => {
        ws.getColumn(exportCols.length + computedCols.length + i + 1).width = Math.min(Math.max(sc.width || 20, 8), 60);
      });

      // Build header→col letter map for formula resolution
      const headerColMap = buildHeaderColMap(exportCols);

      // Image tracking (keep for future logging use)
      void 0;

      // Data rows
      for (let ri = 0; ri < allRows.length; ri++) {
        const row = allRows[ri];
        const r = ws.getRow(headerRow + 1 + ri);
        const excelRowNum = headerRow + 1 + ri;

        // Data columns
        for (let ci = 0; ci < exportCols.length; ci++) {
          const col = exportCols[ci];
          const cell = r.getCell(ci + 1);
          const val = row[col.physicalName];
          const colDef = userColumns.find((c) => c.physicalName === col.physicalName);

          // Handle image columns
          if (col.isImage && isImageUrl(val)) {
            cell.value = "";
            const img = await downloadImage(String(val));
            if (img) {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const imageId = wb.addImage({ buffer: img.buffer as any, extension: img.ext });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ws.addImage as any)(imageId, {
                  tl: { col: ci, row: excelRowNum - 1 },
                  br: { col: ci + 1, row: excelRowNum },
                });
                r.height = Math.max(r.height || cfgRowHeight, Math.min(cfgImgHeight * 0.75, 200));
              } catch {
                cell.value = String(val);
              }
            } else {
              cell.value = String(val);
            }
            cell.style = dataRowStyle;
            continue;
          }

          // Normal value formatting
          if (colDef?.dataType === "BOOLEAN") {
            cell.value = val === 0 || val === "0" || val === false ? "否" : "是";
          } else if (val === null || val === undefined) {
            cell.value = "";
          } else if (["INTEGER", "BIGINT"].includes(colDef?.dataType || "")) {
            cell.value = Number(val);
            cell.numFmt = "0";
          } else if (["FLOAT", "DOUBLE", "DECIMAL"].includes(colDef?.dataType || "")) {
            cell.value = Number(val);
            cell.numFmt = "#,##0.00";
          } else {
            cell.value = String(val);
          }
          cell.style = dataRowStyle;
        }

        // Computed columns
        for (let ci = 0; ci < computedCols.length; ci++) {
          const cc = computedCols[ci];
          const cell = r.getCell(exportCols.length + ci + 1);
          if (cc.expression.trim()) {
            const formula = resolveExpression(cc.expression, headerColMap, excelRowNum);
            // If formula still has {colName} markers, the column references are invalid
            if (!/\{[^}]+\}/.test(formula)) {
              cell.value = { formula };
            } else {
              cell.value = "";
            }
          } else {
            cell.value = "";
          }
          cell.style = dataRowStyle;
        }

        // Static columns
        for (let ci = 0; ci < staticCols.length; ci++) {
          const sc = staticCols[ci];
          const cell = r.getCell(exportCols.length + computedCols.length + ci + 1);
          cell.value = sc.value || "";
          cell.style = dataRowStyle;
        }

        r.height = cfgRowHeight;
      }

      // Auto-filter (data columns only)
      if (allRows.length > 0 && exportCols.length > 0) {
        ws.autoFilter = {
          from: { row: headerRow, column: 1 },
          to: { row: headerRow, column: totalColCount },
        };
      }
    } else {
      // ── Header Position: left ──
      const startRow = logoRowOffset + 1;

      // Set column widths
      ws.getColumn(1).width = Math.max(
        ...exportCols.map((c) => Math.min(c.headerName.length + 4, 40))
      );
      exportCols.forEach((col, ci) => {
        ws.getColumn(ci + 2).width = Math.min(Math.max(col.width || 20, 8), 60);
      });
      computedCols.forEach((cc, ci) => {
        ws.getColumn(exportCols.length + ci + 2).width = Math.min(Math.max(cc.width || 20, 8), 60);
      });

      // Data columns (labels on left)
      for (let ci = 0; ci < exportCols.length; ci++) {
        const col = exportCols[ci];
        const labelRow = ws.getRow(startRow + ci);
        const labelCell = labelRow.getCell(1);
        labelCell.value = col.headerName;
        labelCell.style = headerStyle;

        const dataColIdx = ci + 2;
        for (let ri = 0; ri < allRows.length; ri++) {
          const row = allRows[ri];
          const r = ws.getRow(startRow + ri);
          const cell = r.getCell(dataColIdx);
          const val = row[col.physicalName];
          const colDef = userColumns.find((c) => c.physicalName === col.physicalName);

          if (col.isImage && isImageUrl(val)) {
            cell.value = "";
            const img = await downloadImage(String(val));
            if (img) {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const imageId = wb.addImage({ buffer: img.buffer as any, extension: img.ext });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ws.addImage as any)(imageId, {
                  tl: { col: dataColIdx - 1, row: startRow + ri - 1 },
                  br: { col: dataColIdx, row: startRow + ri },
                });
              } catch {
                cell.value = String(val);
              }
            } else {
              cell.value = String(val);
            }
            r.height = Math.max(r.height || cfgRowHeight, Math.min(cfgImgHeight * 0.75, 200));
            cell.style = dataRowStyle;
            continue;
          }

          if (colDef?.dataType === "BOOLEAN") {
            cell.value = val === 0 || val === "0" || val === false ? "否" : "是";
          } else if (val === null || val === undefined) {
            cell.value = "";
          } else if (["INTEGER", "BIGINT"].includes(colDef?.dataType || "")) {
            cell.value = Number(val);
          } else if (["FLOAT", "DOUBLE", "DECIMAL"].includes(colDef?.dataType || "")) {
            cell.value = Number(val);
          } else {
            cell.value = String(val);
          }
          cell.style = dataRowStyle;
        }
      }

      // Computed columns in "left" layout — add as additional data columns after data
      for (let ci = 0; ci < computedCols.length; ci++) {
        const cc = computedCols[ci];
        const labelRow = ws.getRow(startRow + exportCols.length + ci);
        const labelCell = labelRow.getCell(1);
        labelCell.value = cc.headerName;
        labelCell.style = headerStyle;

        const dataColIdx = exportCols.length + ci + 2;
        for (let ri = 0; ri < allRows.length; ri++) {
          const r = ws.getRow(startRow + ri);
          const cell = r.getCell(dataColIdx);
          const excelRowNum = startRow + ri;
          const hasUnresolved = /\{[^}]+\}/.test(cc.expression);
          if (!hasUnresolved && cc.expression.trim()) {
            cell.value = { formula: resolveExpression(cc.expression, buildHeaderColMap(exportCols), excelRowNum) };
          } else {
            cell.value = "";
          }
          cell.style = dataRowStyle;
        }
      }
    }

    // ── Merge cells ──
    for (const range of cfgMergeCells) {
      try {
        ws.mergeCells(range);
      } catch {
        // invalid range, skip
      }
    }

    // ── Write buffer ──
    const rawBuffer = await wb.xlsx.writeBuffer();
    const buffer = Buffer.from(rawBuffer);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
