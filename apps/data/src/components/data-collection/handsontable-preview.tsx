"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import HotTable from "@handsontable/react";
import "handsontable/styles/handsontable.min.css";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ImageIcon, Eye, Edit3, Lock, Keyboard } from "lucide-react";

// ─── Types ──────────────────────────────────────────────

interface CellMeta {
  formula?: string;
  bold?: boolean;
  italic?: boolean;
  fill?: string;
  color?: string;
  fontSize?: number;
  align?: string;
}

interface MergeCell {
  row: number;
  col: number;
  rowspan: number;
  colspan: number;
}

interface EmbeddedImage {
  row: number;
  col: number;
  dataUrl: string;
}

interface ParseResult {
  headers: string[];
  totalRows: number;
  sampleRows: unknown[][];
  suggestedTypes?: Array<{ columnIndex: number; detectedType: string; confidence: number }>;
  imageColumns?: number[];
  mergedCells?: MergeCell[];
  cellMeta?: Record<string, CellMeta>;
  embeddedImages?: EmbeddedImage[];
}

interface Props {
  parseResult: ParseResult;
  selectedColumns: Set<number>;
  onToggleColumn: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  editable?: boolean;
  editData?: unknown[][];
  onEditChange?: (newData: unknown[][]) => void;
}

// ─── Injected styles ────────────────────────────────────

const THEME_STYLE = `
  .ht-dc-dimmed { opacity: 0.35 !important; pointer-events: none !important; }
  .handsontable td { font-size: 12px !important; padding: 2px 6px !important; white-space: nowrap !important; }
  .handsontable th { font-size: 11px !important; font-weight: 600 !important; background: #f8fafc !important; }
  .ht-dc-img-cell { background: #f8fafc; padding: 2px !important; line-height: 0; }
  .ht-dc-img-cell img { max-height: 36px; border-radius: 3px; object-fit: contain; }
  .ht-dc-formula-cell::after { content: "fx"; position: absolute; top: 1px; right: 2px; font-size: 8px; color: #3b82f6; font-style: italic; }
`;

// ─── Component ──────────────────────────────────────────

export function HandsontablePreview({
  parseResult,
  selectedColumns,
  onToggleColumn,
  onSelectAll,
  onDeselectAll,
  editable = true,
  editData,
  onEditChange,
}: Props) {
  const hotRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const headers = parseResult.headers;
  const sampleRows = parseResult.sampleRows;
  const imageColSet = useMemo(() => new Set(parseResult.imageColumns || []), [parseResult.imageColumns]);
  const allSelected = selectedColumns.size === headers.length;

  // Build data rows
  const tableData: unknown[][] = useMemo(() => {
    const src = editData || sampleRows;
    return src.slice(0, 200).map((row) => {
      const r: unknown[] = [];
      for (let ci = 0; ci < headers.length; ci++) {
        r[ci] = row[ci] ?? "";
      }
      return r;
    });
  }, [editData, sampleRows, headers.length]);

  // Merge cells config
  const mergeCells = useMemo(() => {
    if (!parseResult.mergedCells?.length) return undefined;
    return parseResult.mergedCells.map((m) => ({
      row: m.row, col: m.col, rowspan: m.rowspan, colspan: m.colspan,
    }));
  }, [parseResult.mergedCells]);

  // Embedded images lookup
  const embImgMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const img of parseResult.embeddedImages || []) {
      map.set(`${img.row}_${img.col}`, img.dataUrl);
    }
    return map;
  }, [parseResult.embeddedImages]);

  // Formula cell lookup
  const formulaCells = useMemo(() => {
    const s = new Set<string>();
    if (parseResult.cellMeta) {
      for (const key of Object.keys(parseResult.cellMeta)) {
        if (parseResult.cellMeta[key]?.formula) {
          const [r, c] = key.split("_").map(Number);
          if (!isNaN(r) && !isNaN(c)) {
            // Formula cells already detected from Excel parsing
          }
        }
      }
    }
    return s;
  }, [parseResult.cellMeta]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Inject styles once
  useEffect(() => {
    if (document.getElementById("ht-dc-style")) return;
    const s = document.createElement("style");
    s.id = "ht-dc-style";
    s.textContent = THEME_STYLE;
    document.head.appendChild(s);
  }, []);

  // Column widths
  const colWidths = useMemo(
    () => headers.map((h, ci) =>
      Math.min(Math.max(h.length * 8 + 20, 80), imageColSet.has(ci) ? 130 : 240)
    ),
    [headers, imageColSet]
  );

  // Update cell dimming on selection change
  useEffect(() => {
    const hot = hotRef.current?.hotInstance || hotRef.current;
    if (!hot) return;
    for (let ci = 0; ci < headers.length; ci++) {
      const sel = selectedColumns.has(ci);
      for (let r = 0; r < Math.min(tableData.length, 200); r++) {
        hot.setCellMeta(r, ci, "className", sel ? "" : "ht-dc-dimmed");
      }
    }
    hot.render();
  }, [selectedColumns, headers.length, tableData.length]);

  // Custom cell renderer
  const cellRenderer = useCallback(
    function (instance: unknown, td: HTMLTableCellElement, row: number, col: number, _prop: unknown, value: unknown) {
      td.textContent = "";
      td.className = "";
      td.style.cssText = "";

      // Embedded image
      const embKey = `${row}_${col}`;
      const embDataUrl = embImgMap.get(embKey);
      if (embDataUrl) {
        td.className = "ht-dc-img-cell";
        const img = document.createElement("img");
        img.src = embDataUrl;
        img.style.cssText = "max-height:36px;border-radius:3px;object-fit:contain;display:block;";
        td.appendChild(img);
        if (!selectedColumns.has(col)) td.style.opacity = "0.35";
        return td;
      }

      // URL image
      const isUrlImg = imageColSet.has(col) && typeof value === "string" &&
        /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(value);

      if (isUrlImg) {
        td.className = "ht-dc-img-cell";
        const img = document.createElement("img");
        img.src = value as string;
        img.onerror = function () {
          td.textContent = String(value).slice(0, 20) + "...";
          td.className = "";
        };
        td.appendChild(img);
        if (!selectedColumns.has(col)) td.style.opacity = "0.35";
        return td;
      }

      // Formula indicator
      const metaKey = `${row}_${col}`;
      const meta = (parseResult.cellMeta || {})[metaKey];
      if (meta?.formula) {
        td.className = "ht-dc-formula-cell";
        td.title = `公式: ${meta.formula}`;
      }

      // Style
      if (meta?.bold) td.style.fontWeight = "bold";
      if (meta?.italic) td.style.fontStyle = "italic";
      if (meta?.color) td.style.color = meta.color;
      if (meta?.fill) td.style.backgroundColor = meta.fill;
      if (meta?.align) td.style.textAlign = meta.align;

      td.textContent = value != null ? String(value) : "";
      if (!selectedColumns.has(col)) td.style.opacity = "0.35";

      return td;
    },
    [imageColSet, selectedColumns, embImgMap, parseResult.cellMeta]
  );

  // Columns
  const columns = useMemo(
    () => headers.map((h, ci) => ({
      data: ci,
      title: h,
      type: "text" as const,
      renderer: cellRenderer,
      width: colWidths[ci],
      readOnly: !editMode,
    })),
    [headers, cellRenderer, colWidths, editMode]
  );

  // Data change handler
  const handleChange = useCallback(
    (changes: unknown[][] | null) => {
      if (!changes || !onEditChange) return;
      const newData = tableData.map((r) => [...r]);
      for (const [row, col, _prev, next] of changes) {
        if (typeof row === "number" && typeof col === "number") {
          newData[row][col] = next;
        }
      }
      onEditChange(newData);
    },
    [tableData, onEditChange]
  );

  const ctxMenu = editMode ? [
    "row_above", "row_below", "col_left", "col_right",
    "remove_row", "remove_col", "mergeCells",
    "alignment", "copy", "cut", "paste", "undo", "redo",
  ] : undefined;

  return (
    <div className="space-y-2" ref={containerRef}>
      {/* Top bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {headers.length} 列 · {tableData.length} 行 (共 {parseResult.totalRows} 行)
          · 已选 <strong className="text-foreground">{selectedColumns.size}</strong> 列
          {parseResult.mergedCells?.length ? ` · ${parseResult.mergedCells.length} 个合并` : ""}
          {(parseResult.embeddedImages?.length || imageColSet.size) ? " · 含图片" : ""}
        </span>
        {editMode && (
          <span className="text-green-600 flex items-center gap-1">
            <Eye className="h-3 w-3" />编辑模式
          </span>
        )}
      </div>

      {/* Column selection bar */}
      <div className="flex items-center gap-1.5 flex-wrap border rounded-lg bg-muted/20 px-3 py-1.5">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <Checkbox checked={allSelected} onCheckedChange={() => (allSelected ? onDeselectAll() : onSelectAll())} />
          <span className="font-medium">全选</span>
        </label>
        <span className="text-muted-foreground mx-1">|</span>
        {headers.map((h, ci) => (
          <label
            key={ci}
            onClick={() => onToggleColumn(ci)}
            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded cursor-pointer select-none transition-colors hover:bg-accent ${
              selectedColumns.has(ci) ? "bg-primary/10 text-primary" : "text-muted-foreground"
            }`}
          >
            <Checkbox checked={selectedColumns.has(ci)} onCheckedChange={() => onToggleColumn(ci)} className="h-3 w-3" />
            <span className="truncate max-w-[80px]">{h}</span>
          </label>
        ))}
      </div>

      {/* Handsontable */}
      <div className="border rounded-lg overflow-hidden relative">
        <HotTable
          ref={hotRef}
          data={tableData}
          columns={columns}
          colHeaders={headers}
          rowHeaders={true}
          width={containerWidth || 800}
          height={Math.min(tableData.length * 28 + 40, 480)}
          licenseKey="non-commercial-and-evaluation"
          manualColumnResize={true}
          manualRowResize={editMode}
          fillHandle={editMode}
          undo={editMode}
          selectionMode="range"
          afterChange={handleChange}
          rowHeights={28}
          colWidths={colWidths}
          mergeCells={editMode ? true : mergeCells}
          // @ts-expect-error
          contextMenu={ctxMenu}
          allowInsertRow={editMode}
          allowInsertColumn={editMode}
          allowRemoveRow={editMode}
          allowRemoveColumn={editMode}
          minSpareRows={editMode ? 1 : 0}
          minSpareCols={editMode ? 1 : 0}
        />

        {/* Edit controls overlay */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 z-20">
          <Button
            variant={showShortcuts ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1 shadow-sm bg-white/90 backdrop-blur"
            onClick={() => setShowShortcuts(!showShortcuts)}
          >
            <Keyboard className="h-3 w-3" />
          </Button>
          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            className={`h-7 text-xs gap-1 shadow-sm bg-white/90 backdrop-blur ${
              editMode ? "bg-primary text-primary-foreground" : ""
            }`}
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? <><Lock className="h-3 w-3" />退出编辑</>
                     : <><Edit3 className="h-3 w-3" />编辑数据</>}
          </Button>
        </div>
      </div>

      {/* Shortcuts */}
      {showShortcuts && (
        <div className="border rounded-lg p-3 bg-muted/20 text-xs space-y-1.5">
          <p className="font-medium"><Keyboard className="h-3 w-3 inline mr-1" />快捷键</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-muted-foreground">
            <span><kbd className="bg-muted px-1 rounded text-[10px]">Ctrl+Z</kbd> 撤销</span>
            <span><kbd className="bg-muted px-1 rounded text-[10px]">Ctrl+Y</kbd> 重做</span>
            <span><kbd className="bg-muted px-1 rounded text-[10px]">Ctrl+C</kbd> 复制</span>
            <span><kbd className="bg-muted px-1 rounded text-[10px]">Ctrl+V</kbd> 粘贴</span>
            <span><kbd className="bg-muted px-1 rounded text-[10px]">Delete</kbd> 清除</span>
            <span><kbd className="bg-muted px-1 rounded text-[10px]">Tab</kbd> 下一格</span>
            <span><kbd className="bg-muted px-1 rounded text-[10px]">Enter</kbd> 编辑</span>
            <span><kbd className="bg-muted px-1 rounded text-[10px]">Esc</kbd> 取消编辑</span>
          </div>
        </div>
      )}
    </div>
  );
}
