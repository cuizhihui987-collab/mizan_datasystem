"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ArrowLeft, FileSpreadsheet, Database, CheckCircle2 } from "lucide-react";
import { HandsontablePreview } from "@/components/data-collection/handsontable-preview";
import { ColumnMappingPanel, type ColumnMapping } from "@/components/data-collection/column-mapping-panel";

interface StoredFileItem {
  id: string;
  originalName: string;
  fileSize: number;
  createdAt: string;
  folder: string;
}

interface ParseResult {
  headers: string[];
  totalRows: number;
  sampleRows: unknown[][];
  suggestedTypes: Array<{ columnIndex: number; detectedType: string; confidence: number }>;
  sheetNames?: string[];
  imageColumns?: number[];
}

type Step = "select-file" | "preview" | "mapping" | "importing" | "done";

export default function DataCollectionPage() {
  const params = useParams();
  const router = useRouter();
  const schemaId = params.schemaId as string;

  // ── Wizard state ──
  const [step, setStep] = useState<Step>("select-file");
  const [selectedFile, setSelectedFile] = useState<StoredFileItem | null>(null);
  const [headerRow, setHeaderRow] = useState(1);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<Set<number>>(new Set());
  const [tableName, setTableName] = useState("");
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [createdTableId, setCreatedTableId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ inserted: number; errors: number } | null>(null);

  // ── Fetch files from file management ──
  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ["files", "all", schemaId],
    queryFn: async () => {
      const res = await fetch(`/api/files?pageSize=200`);
      if (!res.ok) throw new Error("获取文件列表失败");
      return res.json() as Promise<{ files: StoredFileItem[]; total: number }>;
    },
  });

  // ── Parse mutation ──
  const parseMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/schemas/${schemaId}/data-collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "parse",
          fileId: selectedFile!.id,
          headerRow,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<ParseResult>;
    },
    onSuccess: (data) => {
      setParseResult(data);
      // 默认全选
      setSelectedColumns(new Set(data.headers.map((_, i) => i)));
      setStep("preview");
    },
    onError: (err) => toast.error("解析失败: " + (err instanceof Error ? err.message : "")),
  });

  // ── Analyze mutation ──
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/schemas/${schemaId}/data-collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze",
          selectedColumns: Array.from(selectedColumns).sort((a, b) => a - b),
          suggestedTypes: parseResult?.suggestedTypes,
          headers: parseResult?.headers,
        }),
      });
      if (!res.ok) throw new Error("分析失败");
      return res.json() as Promise<{ columns: ColumnMapping[] }>;
    },
    onSuccess: (data) => {
      setColumnMappings(data.columns);
      const name = parseResult?.headers[Array.from(selectedColumns)[0]] || "导入数据";
      setTableName(name);
      setStep("mapping");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "分析失败"),
  });

  // ── Create table + import data mutation ──
  const createAndImportMutation = useMutation({
    mutationFn: async () => {
      // Step 1: Create table
      const createRes = await fetch(`/api/schemas/${schemaId}/data-collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-table",
          columns: columnMappings,
          tableName,
        }),
      });
      if (!createRes.ok) throw new Error("创建表失败");
      const tableResult = await createRes.json();
      setCreatedTableId(tableResult.tableId);

      // Step 2: Import data
      const importRes = await fetch(`/api/schemas/${schemaId}/data-collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import-data",
          tableId: tableResult.tableId,
          fileId: selectedFile!.id,
          headerRow,
          columnMapping: columnMappings,
        }),
      });
      if (!importRes.ok) throw new Error("导入数据失败");
      return importRes.json() as Promise<{ inserted: number; errors: number }>;
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep("importing");
      // 完成后跳转到 done 步骤
      setTimeout(() => setStep("done"), 500);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "操作失败"),
  });

  // ── Handlers ──
  const toggleColumn = (index: number) => {
    const next = new Set(selectedColumns);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedColumns(next);
  };

  // ── File selection ──
  const files = filesData?.files || [];
  const excelFiles = files.filter((f) =>
    /\.(xlsx|xls|csv)$/i.test(f.originalName)
  );
  const [searchFile, setSearchFile] = useState("");

  const filteredFiles = searchFile
    ? excelFiles.filter((f) => f.originalName.toLowerCase().includes(searchFile.toLowerCase()))
    : excelFiles;

  // ── Render ──
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/schemas/${schemaId}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" />返回
          </Button>
          <h1 className="text-2xl font-bold">数据收集</h1>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { key: "select-file", label: "选择文件" },
          { key: "preview", label: "预览数据" },
          { key: "mapping", label: "字段映射" },
          { key: "importing", label: "导入数据" },
          { key: "done", label: "完成" },
        ].map((s, idx) => {
          const steps = ["select-file", "preview", "mapping", "importing", "done"];
          const currentIdx = steps.indexOf(step);
          const itemIdx = steps.indexOf(s.key);
          const isActive = itemIdx === currentIdx;
          const isDone = itemIdx < currentIdx;

          return (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  isDone
                    ? "bg-green-100 text-green-700"
                    : isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? <CheckCircle2 className="h-3 w-3" /> : <span>{idx + 1}</span>}
                {s.label}
              </div>
              {idx < 4 && <div className="w-4 h-px bg-border" />}
            </div>
          );
        })}
      </div>

      {/* Step: Select file */}
      {step === "select-file" && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">从文件管理中选择文件</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    支持 .xlsx / .xls / .csv 格式
                  </p>
                </div>
                <Input
                  placeholder="搜索文件..."
                  value={searchFile}
                  onChange={(e) => setSearchFile(e.target.value)}
                  className="w-48 h-8 text-xs"
                />
              </div>

              {filesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="py-8 text-center">
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    {searchFile ? "未找到匹配的文件" : "暂无可用文件，请先上传文件"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => router.push("/files")}
                  >
                    前往文件管理
                  </Button>
                </div>
              ) : (
                <div className="divide-y border rounded-lg max-h-[400px] overflow-y-auto">
                  {filteredFiles.map((file) => {
                    const isSelected = selectedFile?.id === file.id;
                    return (
                      <div
                        key={file.id}
                        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/5" : "hover:bg-accent/30"
                        }`}
                        onClick={() => setSelectedFile(file)}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            checked={isSelected}
                            onChange={() => setSelectedFile(file)}
                            className="shrink-0"
                          />
                          <FileSpreadsheet className="h-6 w-6 text-primary shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{file.originalName}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatSize(file.fileSize)} · {formatDate(file.createdAt)}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {file.folder || "/"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => router.push(`/schemas/${schemaId}`)}>
                  取消
                </Button>
                <Button
                  onClick={() => parseMutation.mutate()}
                  disabled={!selectedFile || parseMutation.isPending}
                >
                  {parseMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />解析中...</>
                  ) : (
                    "解析文件"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Preview */}
      {step === "preview" && parseResult && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">数据预览</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  选择需要导入的列，支持多选
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>表头行:</span>
                  <input
                    type="number"
                    value={headerRow}
                    min={1}
                    onChange={(e) => setHeaderRow(parseInt(e.target.value) || 1)}
                    className="w-14 h-7 text-xs border rounded px-1"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => parseMutation.mutate()}
                  disabled={parseMutation.isPending}
                >
                  重新解析
                </Button>
              </div>
            </div>

            <HandsontablePreview
              parseResult={parseResult}
              selectedColumns={selectedColumns}
              onToggleColumn={toggleColumn}
              onSelectAll={() => setSelectedColumns(new Set(parseResult!.headers.map((_, i) => i)))}
              onDeselectAll={() => setSelectedColumns(new Set())}
              editable={true}
            />

            {/* 快捷选择 */}
            <div className="flex items-center gap-2 text-xs">
              <Button variant="outline" size="sm" className="h-7 text-xs"
                onClick={() => setSelectedColumns(new Set(parseResult.headers.map((_, i) => i)))}>
                全选
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs"
                onClick={() => setSelectedColumns(new Set())}>
                取消全选
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs"
                onClick={() => {
                  const types = parseResult.suggestedTypes || [];
                  const nonText = types
                    .filter((t) => t.detectedType !== "STRING" || t.confidence < 0.5)
                    .map((t) => t.columnIndex);
                  setSelectedColumns(nonText.length > 0 ? new Set(nonText) : new Set(parseResult.headers.map((_, i) => i)));
                }}>
                推荐列
              </Button>
              <span className="text-muted-foreground">
                已选 {selectedColumns.size} / {parseResult.headers.length} 列
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setStep("select-file")}>
                返回
              </Button>
              <Button
                onClick={() => analyzeMutation.mutate()}
                disabled={selectedColumns.size === 0 || analyzeMutation.isPending}
              >
                {analyzeMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />分析中...</>
                ) : (
                  `下一步: 字段映射 (${selectedColumns.size} 列)`
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Mapping */}
      {step === "mapping" && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-medium">字段映射与配置</h3>

            <div>
              <label className="text-sm font-medium">目标表名</label>
              <Input
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="输入表名"
                className="mt-1 h-8"
              />
            </div>

            <ColumnMappingPanel
              columns={columnMappings}
              onChange={setColumnMappings}
            />

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setStep("preview")}>
                返回
              </Button>
              <Button
                onClick={() => createAndImportMutation.mutate()}
                disabled={!tableName.trim() || columnMappings.length === 0 || createAndImportMutation.isPending}
              >
                {createAndImportMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />创建并导入...</>
                ) : (
                  <><Database className="h-4 w-4 mr-2" />创建表并导入数据</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Importing / Done */}
      {(step === "importing" || step === "done") && (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            {step === "importing" ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
                <h3 className="text-lg font-medium">正在导入数据...</h3>
                <p className="text-sm text-muted-foreground">正在创建表结构并写入数据</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-10 w-10 mx-auto text-green-500" />
                <h3 className="text-lg font-medium">导入完成!</h3>
                <div className="flex items-center justify-center gap-4 text-sm">
                  <span className="text-green-600">成功: {importResult?.inserted || 0} 行</span>
                  {importResult?.errors ? (
                    <span className="text-destructive">失败: {importResult.errors} 行</span>
                  ) : null}
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  {createdTableId && (
                    <Button
                      onClick={() => router.push(`/schemas/${schemaId}/tables/${createdTableId}/data`)}
                    >
                      <Database className="h-4 w-4 mr-2" />
                      浏览数据
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => router.push(`/schemas/${schemaId}`)}>
                    返回数据模型
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedFile(null);
                      setParseResult(null);
                      setSelectedColumns(new Set());
                      setColumnMappings([]);
                      setCreatedTableId(null);
                      setImportResult(null);
                      setStep("select-file");
                    }}
                  >
                    继续导入
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
