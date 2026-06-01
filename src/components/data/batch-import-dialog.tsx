"use client";

import * as XLSX from "xlsx";
import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBatchImportStore, genTaskId } from "@/stores/batch-import-store";

interface BatchImportDialogProps {
  tableId: string;
  tableColumns: Array<{ logicalName: string; physicalName: string; dataType: string }>;
  onSuccess: () => void;
}

const KEY_COLUMN_KEYWORDS = ["货号", "item_no", "item_number", "product_code", "sku", "code", "商品编号", "商品代码"];

function detectKeyColumn(headers: string[]): string | null {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  for (const keyword of KEY_COLUMN_KEYWORDS) {
    const idx = lowerHeaders.indexOf(keyword.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  for (const keyword of ["货号", "item", "product", "sku", "code"]) {
    const match = lowerHeaders.find(
      (h) => h.includes(keyword) || keyword.includes(h)
    );
    if (match) return headers[lowerHeaders.indexOf(match)];
  }
  return headers[0] || null;
}

export function BatchImportDialog({
  tableId,
  tableColumns,
  onSuccess,
}: BatchImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "mapping">("upload");
  const [fileRef, setFileRef] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [fileName, setFileName] = useState("");
  const [keyColumn, setKeyColumn] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addTask = useBatchImportStore((s) => s.addTask);
  const updateTask = useBatchImportStore((s) => s.updateTask);

  const reset = () => {
    setStep("upload");
    setFileRef(null);
    setHeaders([]);
    setPreviewRows([]);
    setTotalRows(0);
    setFileName("");
    setKeyColumn("");
    setImporting(false);
    setParseError(null);
  };

  const handleFile = useCallback(async (file: File) => {
    setParseError(null);
    const ext = file.name.split(".").pop()?.toLowerCase();

    try {
      if (ext === "json") {
        const text = await file.text();
        const json = JSON.parse(text);
        const data = Array.isArray(json) ? json : [json];
        if (data.length === 0) throw new Error("JSON 数据为空");
        const cols = Object.keys(data[0]);
        setHeaders(cols);
        setPreviewRows(data.slice(0, 5) as Record<string, unknown>[]);
        setTotalRows(data.length);
        setFileName(file.name);
        setFileRef(file);
        setKeyColumn(detectKeyColumn(cols) || "");
        setStep("mapping");
        return;
      }

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
      });

      if (rawData.length < 2) throw new Error("文件数据不足");

      const cols = (rawData[0] as string[]).map((h) => String(h).trim()).filter(Boolean);
      if (cols.length === 0) throw new Error("未检测到表头");

      const preview: Record<string, unknown>[] = [];
      const maxPreview = Math.min(5, rawData.length - 1);
      for (let i = 1; i <= maxPreview; i++) {
        const row: Record<string, unknown> = {};
        for (let j = 0; j < cols.length; j++) {
          row[cols[j]] = rawData[i]?.[j] ?? "";
        }
        preview.push(row);
      }

      setHeaders(cols);
      setPreviewRows(preview);
      setTotalRows(rawData.length - 1);
      setFileName(file.name);
      setFileRef(file);
      setKeyColumn(detectKeyColumn(cols) || "");
      setStep("mapping");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "文件解析失败");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const startBackgroundImport = async (file: File, keyCol: string) => {
    const taskId = genTaskId();
    const ext = file.name.split(".").pop()?.toLowerCase();

    addTask({
      id: taskId,
      tableId,
      fileName: file.name,
      totalRows,
      processedRows: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      status: "processing",
      createdAt: Date.now(),
    });

    try {
      // Parse full data
      let allRows: Record<string, unknown>[];

      if (ext === "json") {
        const text = await file.text();
        const json = JSON.parse(text);
        allRows = Array.isArray(json) ? json : [json];
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
        });

        const cols = (rawData[0] as string[]).map((h) => String(h).trim()).filter(Boolean);
        allRows = [];
        for (let i = 1; i < rawData.length; i++) {
          const row: Record<string, unknown> = {};
          for (let j = 0; j < cols.length; j++) {
            row[cols[j]] = rawData[i]?.[j] ?? "";
          }
          allRows.push(row);
        }
      }

      updateTask(taskId, { totalRows: allRows.length });

      // Send in chunks
      const CHUNK_SIZE = 500;
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      const allErrors: Array<{ row: number; message: string }> = [];

      for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
        const chunk = allRows.slice(i, i + CHUNK_SIZE);

        const res = await fetch(`/api/tables/${tableId}/batch-import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyColumn: keyCol, rows: chunk }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "导入失败");

        totalInserted += data.inserted || 0;
        totalUpdated += data.updated || 0;
        totalSkipped += data.skipped || 0;
        if (data.errors) {
          allErrors.push(
            ...data.errors.map((e: { row: number; message: string }) => ({
              row: i + e.row,
              message: e.message,
            }))
          );
        }

        updateTask(taskId, {
          processedRows: Math.min(i + CHUNK_SIZE, allRows.length),
          inserted: totalInserted,
          updated: totalUpdated,
          skipped: totalSkipped,
        });
      }

      updateTask(taskId, {
        status: "completed",
        processedRows: allRows.length,
        inserted: totalInserted,
        updated: totalUpdated,
        skipped: totalSkipped,
        errors: allErrors.slice(0, 50),
      });

      onSuccess();
    } catch (err) {
      updateTask(taskId, {
        status: "failed",
        errors: [
          { row: 0, message: err instanceof Error ? err.message : "导入失败" },
        ],
      });
    }
  };

  const handleConfirm = async () => {
    if (!fileRef || !keyColumn) return;
    setImporting(true);
    setOpen(false);
    startBackgroundImport(fileRef, keyColumn);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileUp className="h-4 w-4 mr-1" />
          批量导入
        </Button>
      </DialogTrigger>
      <DialogContent className={cn(
        step === "mapping" ? "max-w-4xl" : "max-w-lg"
      )}>
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "批量导入数据"}
            {step === "mapping" && "字段映射与确认"}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm font-medium mb-1">
              拖放文件到此处，或点击选择文件
            </p>
            <p className="text-xs text-muted-foreground">
              支持 CSV、Excel (.xlsx/.xls)、JSON 格式
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {parseError && (
              <p className="mt-3 text-sm text-destructive">{parseError}</p>
            )}
          </div>
        )}

        {step === "mapping" && headers.length > 0 && (
          <div className="space-y-4 flex flex-col min-h-0">
            <div className="text-sm text-muted-foreground shrink-0">
              文件: <span className="font-medium">{fileName}</span>
              {" | "}共 <span className="font-medium">{totalRows}</span> 行数据
              {" | "}检测到 <span className="font-medium">{headers.length}</span> 列
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <label className="text-sm font-medium whitespace-nowrap">
                匹配字段（货号）：
              </label>
              <Select value={keyColumn} onValueChange={setKeyColumn}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="选择匹配字段" />
                </SelectTrigger>
                <SelectContent>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {keyColumn && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  按此字段匹配已有数据
                </Badge>
              )}
            </div>

            <div className="overflow-x-auto overflow-y-auto border rounded-md min-h-0 max-h-[50vh]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 font-medium w-10 sticky top-0 bg-muted/50">#</th>
                    {headers.map((h) => (
                      <th key={h} className="text-left p-2 font-medium whitespace-nowrap sticky top-0 bg-muted/50">
                        {h}
                        {h === keyColumn && (
                          <Badge variant="outline" className="ml-1 text-[10px] px-1">
                            KEY
                          </Badge>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-2 text-muted-foreground text-xs">{idx + 1}</td>
                      {headers.map((h) => (
                        <td key={h} className="p-2 truncate max-w-[150px]">
                          {String(row[h] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalRows > 5 && (
              <p className="text-xs text-muted-foreground shrink-0">
                仅显示前 5 行预览，共 {totalRows} 行
              </p>
            )}

            <div className="flex flex-col sm:flex-row justify-between gap-2 pt-2 shrink-0">
              <Button variant="outline" onClick={() => setStep("upload")} className="order-2 sm:order-1">
                重新选择文件
              </Button>
              <Button onClick={handleConfirm} disabled={!keyColumn || importing}>
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    启动中...
                  </>
                ) : (
                  "开始导入"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
