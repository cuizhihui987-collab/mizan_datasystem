import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";
import { SpreadsheetParser } from "@/lib/import/spreadsheet-parser";
import path from "path";
import AdmZip from "adm-zip";
import * as XLSX from "xlsx";

/**
 * POST /api/schemas/[schemaId]/data-collect
 * 数据收集流程的核心 API
 *
 * Body:
 *   action: "parse" | "analyze" | "create-table" | "import-data"
 *   fileId?: string            - StoredFile ID (for parse)
 *   headerRow?: number         - header row number (default 1)
 *   selectedColumns?: number[] - 0-based column indices to import
 *   tableName?: string         - target table name
 *   columns?: ColumnMapping[]  - column definitions for table creation
 *   tableId?: string           - table ID for data import
 */

interface ColumnMapping {
  sourceIndex: number;
  logicalName: string;
  dataType: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ schemaId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { schemaId } = await params;
  const body = await req.json();
  const action = body.action;

  // ── 1. Parse: 增强解析 (合并单元格/样式/公式/嵌入图片) ─
  if (action === "parse") {
    const fileId = body.fileId as string;
    const headerRow = (body.headerRow as number) || 1;
    if (!fileId) return NextResponse.json({ error: "缺少文件 ID" }, { status: 400 });

    const storedFile = await prisma.storedFile.findUnique({ where: { id: fileId } });
    if (!storedFile) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

    const filePath = path.join(process.cwd(), "public", "uploads", storedFile.storagePath);
    const parser = new SpreadsheetParser(filePath);
    const result = await parser.parse(headerRow);

    // 用 XLSX 直接读取 workbook 获取更多信息
    const workbook = XLSX.readFile(filePath, { cellStyles: true, cellFormula: true, cellNF: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // ── 合并单元格 ──
    const merges = sheet["!merges"] || [];
    const mergedCells = merges.map((m: XLSX.Range) => ({
      row: m.s.r,
      col: m.s.c,
      rowspan: m.e.r - m.s.r + 1,
      colspan: m.e.c - m.s.c + 1,
    }));

    // ── 单元格样式 & 公式 ──
    const cellMeta: Record<string, { formula?: string; bold?: boolean; italic?: boolean;
      fill?: string; color?: string; fontSize?: number; align?: string; type?: string }> = {};

    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:Z1000");
    for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 200); r++) {
      for (let c = range.s.c; c <= Math.min(range.e.c, range.s.c + result.headers.length + 2); c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        if (!cell) continue;
        const key = `${r}_${c}`;
        const meta: Record<string, unknown> = {};

        // 公式
        if (cell.f) meta.formula = cell.f;

        // 样式
        if (cell.s) {
          const s = cell.s;
          if (s.font?.bold) meta.bold = true;
          if (s.font?.italic) meta.italic = true;
          if (s.font?.sz) meta.fontSize = s.font.sz;
          if (s.font?.color?.rgb) meta.color = rgbToHex(s.font.color.rgb);
          if (s.fill?.fgColor?.rgb) meta.fill = rgbToHex(s.fill.fgColor.rgb);
          if (s.alignment?.horizontal) meta.align = s.alignment.horizontal;
        }

        if (Object.keys(meta).length > 0) cellMeta[key] = meta as typeof cellMeta[string];
      }
    }

    // ── 嵌入图片 (从 xlsx ZIP 提取) ──
    const embeddedImages: Array<{ row: number; col: number; dataUrl: string; width?: number; height?: number }> = [];
    try {
      const zip = new AdmZip(filePath);
      // 查找绘制 XML 来映射图片到单元格
      const drawingEntries = zip.getEntries().filter((e: AdmZip.IZipEntry) =>
        e.entryName.startsWith("xl/drawings/drawing") && e.entryName.endsWith(".xml")
      );

      if (drawingEntries.length > 0) {
        // 读取图片 media
        const mediaEntries = zip.getEntries().filter((e: AdmZip.IZipEntry) =>
          e.entryName.startsWith("xl/media/")
        );

        // 遍历每个媒体文件并分配到默认位置

        // 简化实现: 提取前 20 个图片作为 data URL
        for (let mi = 0; mi < Math.min(mediaEntries.length, 20); mi++) {
          const entry = mediaEntries[mi];
          const ext = path.extname(entry.entryName).toLowerCase().replace(".", "");
          const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : ext === "svg" ? "image/svg+xml" : ext === "webp" ? "image/webp" : "image/png";
          const base64 = entry.getData().toString("base64");
          // 放在第一列的后续行中
          embeddedImages.push({
            row: mi,
            col: 0,
            dataUrl: `data:${mime};base64,${base64}`,
          });
        }

        // 尝试从 drawing XML 解析精确的图片位置
        try {
          const drawingContent = drawingEntries[0].getData().toString("utf8");
          // 解析 twoCellAnchor
          const cellAnchors = drawingContent.match(/<xdr:twoCellAnchor[\w\W]*?<\/xdr:twoCellAnchor>/g) || [];
          for (let ai = 0; ai < Math.min(cellAnchors.length, embeddedImages.length); ai++) {
            const anchor = cellAnchors[ai];
            const colMatch = anchor.match(/<xdr:col>(\d+)</);
            const rowMatch = anchor.match(/<xdr:row>(\d+)</);
            if (rowMatch && colMatch) {
              embeddedImages[ai].row = parseInt(rowMatch[1]);
              embeddedImages[ai].col = parseInt(colMatch[1]);
            }
          }
        } catch { /* drawing XML 解析失败则使用默认位置 */ }
      }
    } catch { /* 图片提取失败不影响主流程 */ }

    // ── 图片列检测 (URL + 嵌入) ──
    const imageColumns: number[] = [];
    const IMAGE_PATTERNS = [
      /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i,
      /^https?:\/\/.*\.(jpg|jpeg|png|gif|webp)/i,
      /^data:image\//i,
    ];
    const IMAGE_HEADER_KEYWORDS = /^(图片|img|pic|image|照片|图|product.*img|商品.*图)/i;

    // 有嵌入图片的列
    const embeddedImgCols = new Set(embeddedImages.map((img) => img.col));

    for (let ci = 0; ci < result.headers.length; ci++) {
      const colValues = result.sampleRows.map((r) => String((r as unknown[])[ci] || ""));
      const headerName = result.headers[ci] || "";
      const headerMatch = IMAGE_HEADER_KEYWORDS.test(headerName);
      const urlImageCount = colValues.filter((v) => IMAGE_PATTERNS.some((p) => p.test(v))).length;
      if (headerMatch || urlImageCount > colValues.length * 0.2 || embeddedImgCols.has(ci)) {
        imageColumns.push(ci);
      }
    }

    return NextResponse.json({
      headers: result.headers,
      totalRows: result.totalRows,
      sampleRows: result.sampleRows,
      suggestedTypes: result.suggestedTypes,
      sheetNames: result.sheetNames,
      imageColumns,
      mergedCells: mergedCells.slice(0, 100),
      cellMeta,
      embeddedImages: embeddedImages.slice(0, 50),
      sheetRef: sheet["!ref"] || "",
    });
  }

  // ── 2. Analyze: 对选中列做 DDL 分析 ────────────────
  if (action === "analyze") {
    const selectedColumns = body.selectedColumns as number[];
    const suggestedTypes = body.suggestedTypes as Array<{
      columnIndex: number;
      detectedType: string;
      confidence: number;
    }>;
    const headers = body.headers as string[];

    if (!selectedColumns?.length || !headers?.length) {
      return NextResponse.json({ error: "缺少选中列或表头" }, { status: 400 });
    }

    const columns: ColumnMapping[] = selectedColumns.map((idx) => {
      const header = headers[idx] || `column_${idx}`;
      // 从 suggestedTypes 获取类型，或默认 STRING
      const typeInfo = suggestedTypes?.find((t) => t.columnIndex === idx);
      const dataType = typeInfo?.detectedType || "STRING";

      // 清理列名: 转为安全物理名
      const logicalName = header.trim();
      const physicalName = logicalName
        .replace(/[^a-zA-Z0-9一-鿿_ ]/g, "")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        || `col_${idx + 1}`;

      return { sourceIndex: idx, logicalName, dataType };
    });

    return NextResponse.json({ columns });
  }

  // ── 3. Create table: 创建表定义 + DDL 执行 ─────────
  if (action === "create-table") {
    const columns = body.columns as ColumnMapping[];
    const tableName = body.tableName as string;
    if (!columns?.length || !tableName) {
      return NextResponse.json({ error: "缺少列定义或表名" }, { status: 400 });
    }

    // 创建 TableDefinition
    const physName = `mzan_tbl_${Math.random().toString(36).slice(2, 12)}`;
    const tableDef = await prisma.tableDefinition.create({
      data: {
        schemaId,
        logicalName: tableName,
        physicalName: physName,
        status: "DRAFT",
        headerRowNumber: 1,
      },
    });

    // 创建 ColumnDefinitions
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const physicalName = col.logicalName
        .replace(/[^a-zA-Z0-9一-鿿_ ]/g, "")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        || `col_${i + 1}`;

      await prisma.columnDefinition.create({
        data: {
          tableId: tableDef.id,
          logicalName: col.logicalName,
          physicalName,
          dataType: col.dataType,
          ordinalPosition: i,
        },
      });
    }

    // 执行简易 DDL: 直接创建物理表
    const typeMap: Record<string, string> = {
      STRING: "TEXT", TEXT: "TEXT", INTEGER: "INTEGER",
      BIGINT: "INTEGER", FLOAT: "REAL", BOOLEAN: "INTEGER",
      DATE: "TEXT", DATETIME: "TEXT", TIME: "TEXT", JSON: "TEXT",
    };
    // 检测编码类字段 (条码/编码/ID/Code等), 强制使用 TEXT 防止溢出
    const codeKeywords = /^(条码|编码|货号|code|barcode|sku|id|编号|序号|item.?no)/i;
    const colDefs = columns.map((c) => {
      const phyName = c.logicalName
        .replace(/[^a-zA-Z0-9一-鿿_ ]/g, "")
        .replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "")
        || `col_${c.sourceIndex + 1}`;
      // 编码类字段强制存为 TEXT, 防止数值溢出
      const isCode = codeKeywords.test(c.logicalName) || codeKeywords.test(phyName);
      if (isCode && (c.dataType === "INTEGER" || c.dataType === "BIGINT")) {
        c.dataType = "STRING";
      }
      const sqlType = typeMap[c.dataType] || "TEXT";
      return `"${phyName}" ${sqlType}`;
    });

    const createSQL = `CREATE TABLE "${physName}" ( "_id" INTEGER PRIMARY KEY AUTOINCREMENT, ${colDefs.join(", ")} )`;
    try {
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${physName}"`);
      await prisma.$executeRawUnsafe(createSQL);
      // 更新状态为 CREATED
      await prisma.tableDefinition.update({
        where: { id: tableDef.id },
        data: { status: "CREATED" },
      });
    } catch (ddlError) {
      console.error("DDL 执行失败:", ddlError);
    }

    return NextResponse.json({
      tableId: tableDef.id,
      physicalName: physName,
      columns: columns.map((c, i) => ({ ...c, physicalName: c.logicalName })),
    });
  }

  // ── 4. Import data: 从原始文件写入数据 ────────────
  if (action === "import-data") {
    const tableId = body.tableId as string;
    const fileId = body.fileId as string;
    const headerRow = (body.headerRow as number) || 1;
    const columnMapping = body.columnMapping as ColumnMapping[];

    if (!tableId || !fileId || !columnMapping?.length) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    const storedFile = await prisma.storedFile.findUnique({ where: { id: fileId } });
    if (!storedFile) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

    const tableDef = await prisma.tableDefinition.findUnique({
      where: { id: tableId },
      include: { columns: true },
    });
    if (!tableDef) return NextResponse.json({ error: "表不存在" }, { status: 404 });

    // 解析文件
    const filePath = path.join(process.cwd(), "public", "uploads", storedFile.storagePath);
    const parser = new SpreadsheetParser(filePath);
    const result = await parser.parse(headerRow);

    const columns = tableDef.columns;
    let inserted = 0;
    let errors = 0;

    // 逐行写入数据
    for (const row of result.sampleRows) {
      const rowArr = row as unknown[];
      const colNames: string[] = [];
      const colValues: string[] = [];

      for (const mapping of columnMapping) {
        const targetCol = columns.find(
          (c) => c.logicalName === mapping.logicalName || c.physicalName === mapping.logicalName
        );
        if (!targetCol) continue;

        const rawVal = rowArr[mapping.sourceIndex];
        colNames.push(`"${targetCol.physicalName}"`);

        if (rawVal === null || rawVal === undefined || rawVal === "") {
          colValues.push("NULL");
        } else if (typeof rawVal === "number" && targetCol.dataType !== "STRING") {
          // 编码类字段即使检测为数字也存为文本
          const isCodeType = /^(条码|编码|货号|code|barcode|sku|id|编号|序号|item.?no)/i.test(targetCol.logicalName);
          if (isCodeType) {
            colValues.push(`'${String(rawVal).replace(/'/g, "''")}'`);
          } else {
            colValues.push(String(rawVal));
          }
        } else {
          colValues.push(`'${String(rawVal).replace(/'/g, "''")}'`);
        }
      }

      if (colNames.length === 0) continue;

      try {
        const { prisma: p } = await import("@/lib/db/prisma");
        await p.$executeRawUnsafe(
          `INSERT INTO "${tableDef.physicalName}" (${colNames.join(", ")}) VALUES (${colValues.join(", ")})`
        );
        inserted++;
      } catch {
        errors++;
      }
    }

    // 标记导入完成
    if (inserted > 0) {
      await prisma.tableDefinition.update({
        where: { id: tableId },
        data: { status: "IMPORTED" },
      });
    }

    return NextResponse.json({ inserted, errors, total: inserted + errors });
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}

// ─── Helper: RGB hex ─────────────────────────────────
function rgbToHex(rgb: string | number | undefined): string | undefined {
  if (!rgb) return undefined;
  if (typeof rgb === "number") return `#${rgb.toString(16).padStart(6, "0")}`;
  const s = String(rgb).replace(/^#/, "");
  if (s.length === 6) return `#${s}`;
  if (s.length === 8) return `#${s.slice(2)}`; // ARGB → RBG
  return undefined;
}
