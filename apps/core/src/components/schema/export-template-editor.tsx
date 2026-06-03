"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  FileDown,
  GripVertical,
  Image,
  Loader2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────

interface ExportColumnConfig {
  physicalName: string;
  headerName: string;
  width: number;
  selected: boolean;
  isImage?: boolean;
}

interface ComputedColumnConfig {
  headerName: string;
  expression: string;
  width: number;
}

interface CustomStaticColumn {
  headerName: string;
  value: string;
  width: number;
}

interface ExportTemplateConfig {
  format: "xlsx" | "csv";
  filePattern: string;
  sheetName: string;
  headerPosition: "top" | "left";
  logoImage?: string;
  logoWidth?: number;
  columns: ExportColumnConfig[];
  computedColumns?: ComputedColumnConfig[];
  customStaticColumns?: CustomStaticColumn[];
  rowHeight?: number;
  fontSize?: number;
  headerFontSize?: number;
  headerBgColor?: string;
  headerFontColor?: string;
  imageWidth?: number;
  imageHeight?: number;
  horizontalAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  wrapText?: boolean;
  mergedCells?: string[];
}

interface ExportTemplate {
  id: string;
  templateName: string;
  config: ExportTemplateConfig;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TableInfo {
  id: string;
  logicalName: string;
  physicalName: string;
  status: string;
}

const DEFAULT_PATTERN = "{tableName}_{date}";

// ─── Template Editor (Schema page) ────────────────

export function ExportTemplateEditor({ schemaId }: { schemaId: string }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExportTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [filePattern, setFilePattern] = useState(DEFAULT_PATTERN);
  const [sheetName, setSheetName] = useState("Sheet1");
  const [headerPosition, setHeaderPosition] = useState<"top" | "left">("top");
  const [logoImage, setLogoImage] = useState("");
  const [logoWidth, setLogoWidth] = useState(200);
  const [columns, setColumns] = useState<ExportColumnConfig[]>([]);
  const [computedColumns, setComputedColumns] = useState<ComputedColumnConfig[]>([]);
  const [customStaticColumns, setCustomStaticColumns] = useState<CustomStaticColumn[]>([]);
  const [rowHeight, setRowHeight] = useState(20);
  const [fontSize, setFontSize] = useState(10);
  const [headerFontSize, setHeaderFontSize] = useState(11);
  const [headerBgColor, setHeaderBgColor] = useState("FF4F81BD");
  const [headerFontColor, setHeaderFontColor] = useState("FFFFFFFF");
  const [imageWidth, setImageWidth] = useState(100);
  const [imageHeight, setImageHeight] = useState(50);
  const [horizontalAlign, setHorizontalAlign] = useState<"left" | "center" | "right">("left");
  const [verticalAlign, setVerticalAlign] = useState<"top" | "middle" | "bottom">("middle");
  const [wrapText, setWrapText] = useState(true);
  const [mergedCellsText, setMergedCellsText] = useState("");
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [tables, setTables] = useState<TableInfo[]>([]);

  const loadTables = async () => {
    try {
      const tablesRes = await fetch(`/api/schemas/${schemaId}`);
      const schemaData = await tablesRes.json();
      const tbls = (schemaData.tables || []).filter(
        (t: TableInfo) => t.status !== "DRAFT"
      );
      setTables(tbls);
      if (tbls.length > 0 && !selectedTableId) {
        setSelectedTableId(tbls[0].id);
      }
    } catch { /* ignore */ }
  };

  const { data: templates, isLoading } = useQuery<ExportTemplate[]>({
    queryKey: ["templates", schemaId],
    queryFn: () => fetch(`/api/schemas/${schemaId}/templates`).then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (tid: string) =>
      fetch(`/api/schemas/${schemaId}/templates/${tid}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      toast.success("模板已删除");
      queryClient.invalidateQueries({ queryKey: ["templates", schemaId] });
    },
  });

  const resetForm = () => {
    setTemplateName("");
    setDescription("");
    setFormat("xlsx");
    setFilePattern(DEFAULT_PATTERN);
    setSheetName("Sheet1");
    setHeaderPosition("top");
    setLogoImage("");
    setLogoWidth(200);
    setColumns([]);
    setComputedColumns([]);
    setCustomStaticColumns([]);
    setRowHeight(20);
    setFontSize(10);
    setHeaderFontSize(11);
    setHeaderBgColor("FF4F81BD");
    setHeaderFontColor("FFFFFFFF");
    setImageWidth(100);
    setImageHeight(50);
    setHorizontalAlign("left");
    setVerticalAlign("middle");
    setWrapText(true);
    setMergedCellsText("");
    setEditing(null);
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
    setTimeout(() => {
      loadTables();
      setTimeout(() => loadTableColumns(), 100);
    }, 50);
  };

  const openEdit = (tmpl: ExportTemplate) => {
    setEditing(tmpl);
    setTemplateName(tmpl.templateName);
    setDescription(tmpl.description || "");
    setFormat(tmpl.config.format || "xlsx");
    setFilePattern(tmpl.config.filePattern || DEFAULT_PATTERN);
    setSheetName(tmpl.config.sheetName || "Sheet1");
    setHeaderPosition(tmpl.config.headerPosition || "top");
    setLogoImage(tmpl.config.logoImage || "");
    setLogoWidth(tmpl.config.logoWidth || 200);
    setColumns(tmpl.config.columns || []);
    setComputedColumns(tmpl.config.computedColumns || []);
    setCustomStaticColumns(tmpl.config.customStaticColumns || []);
    setRowHeight(tmpl.config.rowHeight ?? 20);
    setFontSize(tmpl.config.fontSize ?? 10);
    setHeaderFontSize(tmpl.config.headerFontSize ?? 11);
    setHeaderBgColor(tmpl.config.headerBgColor || "FF4F81BD");
    setHeaderFontColor(tmpl.config.headerFontColor || "FFFFFFFF");
    setImageWidth(tmpl.config.imageWidth ?? 100);
    setImageHeight(tmpl.config.imageHeight ?? 50);
    setHorizontalAlign(tmpl.config.horizontalAlign || "left");
    setVerticalAlign(tmpl.config.verticalAlign || "middle");
    setWrapText(tmpl.config.wrapText !== false);
    setMergedCellsText((tmpl.config.mergedCells || []).join("\n"));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!templateName) {
      toast.error("请输入模板名称");
      return;
    }

    const config: ExportTemplateConfig = {
      format,
      filePattern: filePattern || DEFAULT_PATTERN,
      sheetName,
      headerPosition,
      columns: columns
        .filter((c) => c.selected)
        .map((c) => ({ ...c, selected: true })),
      computedColumns: computedColumns.filter((c) => c.headerName.trim() && c.expression.trim()),
      customStaticColumns: customStaticColumns.filter((c) => c.headerName.trim()),
      rowHeight,
      fontSize,
      headerFontSize,
      headerBgColor,
      headerFontColor,
      imageWidth,
      imageHeight,
      horizontalAlign,
      verticalAlign,
      wrapText,
      mergedCells: mergedCellsText.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    if (logoImage) {
      config.logoImage = logoImage;
      config.logoWidth = logoWidth;
    }

    try {
      const body = { templateName, config: JSON.stringify(config), description };
      let res: Response;

      if (editing) {
        res = await fetch(`/api/schemas/${schemaId}/templates/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`/api/schemas/${schemaId}/templates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");

      toast.success(editing ? "模板已更新" : "模板已创建");
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["templates", schemaId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    }
  };

  const loadTableColumns = async (tableId?: string) => {
    const tid = tableId || selectedTableId;
    if (!tid) return;
    try {
      const tableRes = await fetch(`/api/tables/${tid}`);
      const tableData = await tableRes.json();
      const cols: Array<{ logicalName: string; physicalName: string }> = (
        tableData.columns || []
      ).filter(
        (c: { physicalName: string }) =>
          !["_id", "_created_at", "_updated_at"].includes(c.physicalName)
      );

      setColumns(
        cols.map((c) => ({
          physicalName: c.physicalName,
          headerName: c.logicalName,
          width: 20,
          selected: true,
        }))
      );
    } catch {
      // ignore
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("请上传图片文件");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("图片大小不能超过 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" />
              新建模板
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{editing ? "编辑模板" : "新建导出模板"}</DialogTitle>
            </DialogHeader>

            <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
              <div className="w-1/2 overflow-y-auto space-y-4 py-2 pr-2">
              {/* Basic info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">模板名称</label>
                  <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="例如: 商品数据导出" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">导出格式</label>
                  <Select value={format} onValueChange={(v) => setFormat(v as "xlsx" | "csv")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xlsx">Excel (.xlsx) — 支持样式/图片</SelectItem>
                      <SelectItem value="csv">CSV (.csv) — 纯数据</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">
                  文件名模板
                  <span className="text-xs text-muted-foreground ml-2">
                    支持: {`{tableName}`} {`{date}`} {`{datetime}`} {`{schemaName}`} {`{col:字段物理名}`}
                  </span>
                </label>
                <Input
                  value={filePattern}
                  onChange={(e) => setFilePattern(e.target.value)}
                  placeholder={DEFAULT_PATTERN}
                  className="font-mono text-sm"
                />
                {columns.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="text-[10px] text-muted-foreground leading-6">插入字段值:</span>
                    {columns.map((col) => (
                      <button
                        key={col.physicalName}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-accent text-muted-foreground font-mono"
                        onClick={() => {
                          const tag = `{col:${col.physicalName}}`;
                          if (!filePattern.includes(tag)) {
                            setFilePattern((prev) => prev + tag);
                          }
                        }}
                        title={`插入 {col:${col.physicalName}}`}
                      >
                        {col.headerName || col.physicalName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">工作表名称</label>
                  <Input value={sheetName} onChange={(e) => setSheetName(e.target.value)} placeholder="Sheet1" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">表头位置</label>
                  <Select value={headerPosition} onValueChange={(v) => setHeaderPosition(v as "top" | "left")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">顶部（标准表格）</SelectItem>
                      <SelectItem value="left">左侧（纵向标签）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Table selector */}
              <div>
                <label className="text-sm font-medium block mb-1">选择数据表</label>
                <Select
                  value={selectedTableId}
                  onValueChange={(v) => {
                    setSelectedTableId(v);
                    loadTableColumns(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择数据表" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.logicalName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Logo upload */}
              <div>
                <label className="text-sm font-medium block mb-1">公司 Logo (可选)</label>
                <div className="flex items-start gap-3">
                  <div
                    className="border-2 border-dashed rounded-md w-32 h-20 flex items-center justify-center cursor-pointer hover:bg-muted/50 relative overflow-hidden"
                    onClick={() => document.getElementById("logo-upload")?.click()}
                  >
                    {logoImage ? (
                      <img src={logoImage} alt="logo" className="max-w-full max-h-full object-contain p-1" />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <Image className="h-6 w-6 mx-auto mb-1" />
                        <span className="text-[10px]">点击上传</span>
                      </div>
                    )}
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    {logoImage && (
                      <>
                        <p className="text-xs text-muted-foreground break-all">已选择图片</p>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground">宽度: </label>
                          <Input
                            type="number"
                            value={logoWidth}
                            onChange={(e) => setLogoWidth(Number(e.target.value) || 200)}
                            className="h-7 w-20 text-xs"
                            min={50}
                            max={800}
                          />
                          <span className="text-xs text-muted-foreground">px</span>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => setLogoImage("")}>
                            移除
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ─── Style Settings ─── */}
              <details className="border rounded-md">
                <summary className="text-sm font-medium p-3 cursor-pointer hover:bg-muted/50">
                  样式设置
                </summary>
                <div className="p-3 border-t space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-medium block mb-1">行高</label>
                      <Input type="number" value={rowHeight} onChange={(e) => setRowHeight(Number(e.target.value) || 20)} className="h-7 text-xs" min={10} max={200} />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium block mb-1">数据字号</label>
                      <Input type="number" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value) || 10)} className="h-7 text-xs" min={6} max={72} />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium block mb-1">表头字号</label>
                      <Input type="number" value={headerFontSize} onChange={(e) => setHeaderFontSize(Number(e.target.value) || 11)} className="h-7 text-xs" min={6} max={72} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium block mb-1">表头背景色</label>
                      <div className="flex gap-2">
                        <input type="color" value={`#${headerBgColor.slice(2)}`} onChange={(e) => setHeaderBgColor("FF" + e.target.value.slice(1))} className="h-7 w-10 p-0.5 cursor-pointer border rounded" />
                        <Input value={headerBgColor} onChange={(e) => setHeaderBgColor(e.target.value)} className="h-7 text-[10px] font-mono flex-1" />
                      </div>
                      <div className="flex gap-1 mt-1">
                        {["FF4F81BD", "FF2E75B6", "FF4472C4", "FF548235", "FFBF8F00", "FF843C0C", "FFC00000", "FF404040"].map((c) => (
                          <button key={c} type="button" className={`w-4 h-4 rounded-sm border cursor-pointer ${headerBgColor === c ? "ring-2 ring-offset-1 ring-primary" : ""}`} style={{ backgroundColor: `#${c.slice(2)}` }} onClick={() => setHeaderBgColor(c)} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium block mb-1">表头字体色</label>
                      <div className="flex gap-2">
                        <input type="color" value={`#${headerFontColor.slice(2)}`} onChange={(e) => setHeaderFontColor("FF" + e.target.value.slice(1))} className="h-7 w-10 p-0.5 cursor-pointer border rounded" />
                        <Input value={headerFontColor} onChange={(e) => setHeaderFontColor(e.target.value)} className="h-7 text-[10px] font-mono flex-1" />
                      </div>
                      <div className="flex gap-1 mt-1">
                        {["FFFFFFFF", "FF000000", "FF333333", "FF4472C4", "FFC00000"].map((c) => (
                          <button key={c} type="button" className={`w-4 h-4 rounded-sm border cursor-pointer ${headerFontColor === c ? "ring-2 ring-offset-1 ring-primary" : ""}`} style={{ backgroundColor: `#${c.slice(2)}`, border: c === "FFFFFFFF" ? "1px solid #ccc" : undefined }} onClick={() => setHeaderFontColor(c)} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium block mb-1">图片宽度 (px)</label>
                      <Input type="number" value={imageWidth} onChange={(e) => setImageWidth(Number(e.target.value) || 100)} className="h-7 text-xs" min={20} max={800} />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium block mb-1">图片高度 (px)</label>
                      <Input type="number" value={imageHeight} onChange={(e) => setImageHeight(Number(e.target.value) || 50)} className="h-7 text-xs" min={20} max={800} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-medium block mb-1">水平对齐</label>
                      <select value={horizontalAlign} onChange={(e) => setHorizontalAlign(e.target.value as "left" | "center" | "right")} className="h-7 text-xs w-full rounded-md border border-input bg-background px-2">
                        <option value="left">左对齐</option>
                        <option value="center">居中</option>
                        <option value="right">右对齐</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium block mb-1">垂直对齐</label>
                      <select value={verticalAlign} onChange={(e) => setVerticalAlign(e.target.value as "top" | "middle" | "bottom")} className="h-7 text-xs w-full rounded-md border border-input bg-background px-2">
                        <option value="top">顶部</option>
                        <option value="middle">居中</option>
                        <option value="bottom">底部</option>
                      </select>
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={wrapText} onChange={(e) => setWrapText(e.target.checked)} className="h-4 w-4" />
                        <span className="text-[11px] font-medium">自动换行</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium block mb-1">合并单元格</label>
                    <textarea
                      value={mergedCellsText}
                      onChange={(e) => setMergedCellsText(e.target.value)}
                      className="h-14 text-xs w-full rounded-md border border-input bg-background px-2 py-1 resize-none"
                      placeholder={"A1:E1\nA2:C2"}
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">每行一个区域，例如 A1:E1</p>
                  </div>
                </div>
              </details>

              {/* ─── Custom Static Columns ─── */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">自定义静态列</label>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCustomStaticColumns((prev) => [...prev, { headerName: "", value: "", width: 20 }])}>
                    <Plus className="h-3 w-3 mr-1" />
                    添加静态列
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">所有行输出相同的固定值</p>
                {customStaticColumns.length === 0 ? (
                  <div className="border rounded-md p-4 text-center text-sm text-muted-foreground">暂无静态列</div>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-2 font-medium">列名</th>
                          <th className="text-left p-2 font-medium">固定值</th>
                          <th className="text-left p-2 font-medium w-20">列宽</th>
                          <th className="p-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {customStaticColumns.map((sc, idx) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="p-2">
                              <Input value={sc.headerName} onChange={(e) => setCustomStaticColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, headerName: e.target.value } : c)))} className="h-7 text-xs" placeholder="例如: 备注" />
                            </td>
                            <td className="p-2">
                              <Input value={sc.value} onChange={(e) => setCustomStaticColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, value: e.target.value } : c)))} className="h-7 text-xs" placeholder="固定文本" />
                            </td>
                            <td className="p-2">
                              <Input type="number" value={sc.width} onChange={(e) => setCustomStaticColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, width: parseInt(e.target.value) || 20 } : c)))} className="h-7 text-xs w-16" min={5} max={100} />
                            </td>
                            <td className="p-2">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setCustomStaticColumns((prev) => prev.filter((_, i) => i !== idx))}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Column config */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">导出字段</label>
                  <span className="text-xs text-muted-foreground">
                    {columns.filter((c) => c.selected).length} / {columns.length} 列
                  </span>
                </div>
                {columns.length === 0 ? (
                  <div className="border rounded-md p-4 text-center text-sm text-muted-foreground">
                    该数据模型下没有数据表
                  </div>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-2 w-8"></th>
                          <th className="p-2 w-10"></th>
                          <th className="text-left p-2 font-medium">物理名</th>
                          <th className="text-left p-2 font-medium">导出列名</th>
                          <th className="text-left p-2 font-medium w-20">列宽</th>
                          <th className="text-center p-2 font-medium w-16">图片列</th>
                        </tr>
                      </thead>
                      <tbody>
                        {columns.map((col, idx) => (
                          <tr key={col.physicalName} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="p-2 text-muted-foreground">
                              <GripVertical className="h-3.5 w-3.5" />
                            </td>
                            <td className="p-2">
                              <Checkbox
                                checked={col.selected}
                                onCheckedChange={() =>
                                  setColumns((prev) =>
                                    prev.map((c, i) => (i === idx ? { ...c, selected: !c.selected } : c))
                                  )
                                }
                              />
                            </td>
                            <td className="p-2 font-mono text-xs">{col.physicalName}</td>
                            <td className="p-2">
                              <Input
                                value={col.headerName}
                                onChange={(e) =>
                                  setColumns((prev) =>
                                    prev.map((c, i) => (i === idx ? { ...c, headerName: e.target.value } : c))
                                  )
                                }
                                className="h-7 text-xs"
                                disabled={!col.selected}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                value={col.width}
                                onChange={(e) =>
                                  setColumns((prev) =>
                                    prev.map((c, i) => (i === idx ? { ...c, width: parseInt(e.target.value) || 20 } : c))
                                  )
                                }
                                className="h-7 text-xs w-16"
                                min={5}
                                max={100}
                                disabled={!col.selected}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Checkbox
                                checked={col.isImage || false}
                                disabled={!col.selected}
                                onCheckedChange={() =>
                                  setColumns((prev) =>
                                    prev.map((c, i) => (i === idx ? { ...c, isImage: !c.isImage } : c))
                                  )
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Computed columns */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">计算列</label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      setComputedColumns((prev) => [
                        ...prev,
                        { headerName: "", expression: "", width: 20 },
                      ])
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    添加计算列
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  使用 {'{列名}'} 引用导出列的数值，例如: {'{最低起订量}'} / {'{装箱量}'}
                </p>
                {computedColumns.length === 0 ? (
                  <div className="border rounded-md p-4 text-center text-sm text-muted-foreground">
                    暂无计算列
                  </div>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-2 font-medium">列名</th>
                          <th className="text-left p-2 font-medium">公式</th>
                          <th className="text-left p-2 font-medium w-20">列宽</th>
                          <th className="p-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {computedColumns.map((cc, idx) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="p-2">
                              <Input
                                value={cc.headerName}
                                onChange={(e) =>
                                  setComputedColumns((prev) =>
                                    prev.map((c, i) => (i === idx ? { ...c, headerName: e.target.value } : c))
                                  )
                                }
                                className="h-7 text-xs"
                                placeholder="例如: 起订箱数"
                              />
                            </td>
                            <td className="p-2">
                              <div className="flex items-center gap-1">
                                <Input
                                  value={cc.expression}
                                  onChange={(e) =>
                                    setComputedColumns((prev) =>
                                      prev.map((c, i) => (i === idx ? { ...c, expression: e.target.value } : c))
                                    )
                                  }
                                  className="h-7 text-xs font-mono flex-1"
                                  placeholder={'例如: {最低起订量}/{装箱量}'}
                                />
                                {columns.filter((c) => c.selected).length > 0 && (
                                  <div className="relative group">
                                    <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                                      {'{列}'}
                                    </Button>
                                    <div className="absolute right-0 top-full mt-1 bg-popover border rounded-md shadow-lg z-10 hidden group-hover:block min-w-[140px]">
                                      {columns.filter((c) => c.selected).map((c) => (
                                        <button
                                          key={c.physicalName}
                                          className="block w-full text-left px-3 py-1.5 text-xs hover:bg-accent font-mono"
                                          onClick={() =>
                                            setComputedColumns((prev) =>
                                              prev.map((col, i) =>
                                                i === idx
                                                  ? { ...col, expression: col.expression + `{${c.headerName}}` }
                                                  : col
                                              )
                                            )
                                          }
                                        >
                                          {c.headerName}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                value={cc.width}
                                onChange={(e) =>
                                  setComputedColumns((prev) =>
                                    prev.map((c, i) => (i === idx ? { ...c, width: parseInt(e.target.value) || 20 } : c))
                                  )
                                }
                                className="h-7 text-xs w-16"
                                min={5}
                                max={100}
                              />
                            </td>
                            <td className="p-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() =>
                                  setComputedColumns((prev) => prev.filter((_, i) => i !== idx))
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              </div>
              {/* end left column */}

              {/* ─── Right: Preview Panel ─── */}
              <div className="w-1/2 overflow-y-auto py-2 pl-2 border-l">
                <div className="sticky top-0 bg-background pb-2 z-10">
                  <label className="text-sm font-medium">预览效果</label>
                  <p className="text-[10px] text-muted-foreground">显示 3 行占位数据</p>
                </div>
                <div className="overflow-auto border rounded-md" style={{ maxHeight: "calc(90vh - 200px)" }}>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        {columns.filter(c => c.selected).map((col) => (
                          <th
                            key={col.physicalName}
                            style={{
                              backgroundColor: `#${headerBgColor.slice(2)}`,
                              color: `#${headerFontColor.slice(2)}`,
                              fontSize: `${headerFontSize}px`,
                              fontWeight: "bold",
                              padding: "4px 6px",
                              border: "1px solid #ccc",
                              whiteSpace: "nowrap",
                              width: col.width ? `${col.width * 6}px` : "auto",
                            }}
                          >
                            {col.headerName || col.physicalName}
                          </th>
                        ))}
                        {computedColumns.filter(c => c.headerName.trim()).map((cc, i) => (
                          <th key={`cc-${i}`}
                            style={{
                              backgroundColor: `#${headerBgColor.slice(2)}`,
                              color: `#${headerFontColor.slice(2)}`,
                              fontSize: `${headerFontSize}px`,
                              fontWeight: "bold",
                              padding: "4px 6px",
                              border: "1px solid #ccc",
                              whiteSpace: "nowrap",
                              width: cc.width ? `${cc.width * 6}px` : "auto",
                            }}
                          >{cc.headerName}</th>
                        ))}
                        {customStaticColumns.filter(c => c.headerName.trim()).map((sc, i) => (
                          <th key={`sc-${i}`}
                            style={{
                              backgroundColor: `#${headerBgColor.slice(2)}`,
                              color: `#${headerFontColor.slice(2)}`,
                              fontSize: `${headerFontSize}px`,
                              fontWeight: "bold",
                              padding: "4px 6px",
                              border: "1px solid #ccc",
                              whiteSpace: "nowrap",
                              width: sc.width ? `${sc.width * 6}px` : "auto",
                            }}
                          >{sc.headerName}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3].map((ri) => (
                        <tr key={ri} style={{ height: `${Math.max(rowHeight, 20)}px` }}>
                          {columns.filter(c => c.selected).map((col) => (
                            <td
                              key={col.physicalName}
                              style={{
                                fontSize: `${fontSize}px`,
                                padding: "2px 6px",
                                border: "1px solid #ddd",
                                textAlign: horizontalAlign,
                                verticalAlign,
                                whiteSpace: wrapText ? "normal" : "nowrap",
                              }}
                            >
                              {col.isImage ? (
                                <div
                                  style={{
                                    width: `${imageWidth}px`,
                                    height: `${imageHeight}px`,
                                    background: "#e0e0e0",
                                    border: "1px dashed #999",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "9px",
                                    color: "#666",
                                  }}
                                >
                                  {imageWidth}×{imageHeight}
                                </div>
                              ) : (
                                <span style={{ color: "#999" }}>示例数据{ri}</span>
                              )}
                            </td>
                          ))}
                          {computedColumns.filter(c => c.headerName.trim()).map((_cc, i) => (
                            <td key={`cc-${i}`}
                              style={{
                                fontSize: `${fontSize}px`,
                                padding: "2px 6px",
                                border: "1px solid #ddd",
                                textAlign: horizontalAlign,
                                verticalAlign,
                                whiteSpace: wrapText ? "normal" : "nowrap",
                              }}
                            ><span style={{ color: "#bbb" }}>=公式({ri})</span></td>
                          ))}
                          {customStaticColumns.filter(c => c.headerName.trim()).map((sc, i) => (
                            <td key={`sc-${i}`}
                              style={{
                                fontSize: `${fontSize}px`,
                                padding: "2px 6px",
                                border: "1px solid #ddd",
                                textAlign: horizontalAlign,
                                verticalAlign,
                                whiteSpace: wrapText ? "normal" : "nowrap",
                              }}
                            >{sc.value || <span style={{ color: "#bbb" }}>固定值</span>}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t shrink-0">
              <DialogClose asChild>
                <Button variant="outline" size="sm">取消</Button>
              </DialogClose>
              <Button size="sm" onClick={handleSave} disabled={!templateName}>
                {editing ? "保存" : "创建"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(!Array.isArray(templates) || templates.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileDown className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">还没有导出模板</p>
            <p className="text-xs text-muted-foreground mt-1">
              创建模板后可自定义导出字段、列名、样式、Logo 和文件命名规则
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((tmpl) => (
            <Card key={tmpl.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {tmpl.templateName}
                      <Badge variant="outline" className="text-[10px]">
                        {tmpl.config.format?.toUpperCase() || "XLSX"}
                      </Badge>
                      {tmpl.config.logoImage && (
                        <Badge variant="secondary" className="text-[10px]">含Logo</Badge>
                      )}
                    </CardTitle>
                    {tmpl.description && (
                      <p className="text-xs text-muted-foreground mt-1">{tmpl.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(tmpl)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除</AlertDialogTitle>
                          <AlertDialogDescription>确定要删除模板 &ldquo;{tmpl.templateName}&rdquo; 吗？</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(tmpl.id)} className="bg-destructive text-destructive-foreground">
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>格式: {tmpl.config.format?.toUpperCase() || "XLSX"}</span>
                  <span>|</span>
                  <span>表头: {tmpl.config.headerPosition === "left" ? "左侧" : "顶部"}</span>
                  <span>|</span>
                  <span>字段: {tmpl.config.columns?.filter((c: ExportColumnConfig) => c.selected !== false).length || 0} 列</span>
                  <span>|</span>
                  <span>文件名: {tmpl.config.filePattern || DEFAULT_PATTERN}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Export Wizard (Data page) ─────────────────────

interface FilterCond {
  column: string;
  operator: string;
  value: string;
}

const FILTER_OPERATORS: { value: string; label: string }[] = [
  { value: "eq", label: "等于" },
  { value: "neq", label: "不等于" },
  { value: "contains", label: "包含" },
  { value: "startsWith", label: "开头是" },
  { value: "endsWith", label: "结尾是" },
  { value: "gt", label: "大于" },
  { value: "gte", label: "大于等于" },
  { value: "lt", label: "小于" },
  { value: "lte", label: "小于等于" },
  { value: "isEmpty", label: "为空" },
  { value: "isNotEmpty", label: "不为空" },
];

interface ExportWizardDialogProps {
  schemaId: string;
  tableId?: string; // optional — if provided, pre-selects this table
  tables?: TableInfo[]; // list of available tables
}

export function ExportWithTemplateDialog({ schemaId, tableId, tables: externalTables }: ExportWizardDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState(tableId || "");
  const [filters, setFilters] = useState<FilterCond[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const { data: fetchedTables } = useQuery<{ tables: TableInfo[] }>({
    queryKey: ["schema", schemaId],
    queryFn: () => fetch(`/api/schemas/${schemaId}`).then((r) => r.json()),
    enabled: open && !externalTables,
  });

  const tables = externalTables || fetchedTables?.tables || [];

  const { data: tableMeta } = useQuery({
    queryKey: ["table", selectedTable],
    queryFn: () => fetch(`/api/tables/${selectedTable}`).then((r) => r.json()),
    enabled: !!selectedTable,
  });

  const { data: templates, isLoading: tmplLoading } = useQuery<ExportTemplate[]>({
    queryKey: ["templates", schemaId],
    queryFn: () => fetch(`/api/schemas/${schemaId}/templates`).then((r) => r.json()),
    enabled: open,
  });

  const userColumns: Array<{ logicalName: string; physicalName: string; dataType: string }> =
    tableMeta?.columns?.filter(
      (c: { physicalName: string }) => !["_id", "_created_at", "_updated_at"].includes(c.physicalName)
    ) || [];

  const handleExport = async () => {
    if (!selectedTemplate || !selectedTable) return;
    setExporting(true);

    try {
      const validFilters = filters.filter(
        (f) => f.column && (f.operator === "isEmpty" || f.operator === "isNotEmpty" || f.value !== "")
      );
      const res = await fetch(`/api/schemas/${schemaId}/templates/${selectedTemplate}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: selectedTable,
          filters: validFilters.length > 0 ? validFilters : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "导出失败");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)/);
      const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : "export.xlsx";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`导出完成：${filename}`);
      setOpen(false);
      setSelectedTemplate("");
      setFilters([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  const addFilter = () => {
    if (userColumns.length === 0) return;
    setFilters((prev) => [
      ...prev,
      { column: userColumns[0].physicalName, operator: "contains", value: "" },
    ]);
  };

  const updateFilter = (idx: number, field: keyof FilterCond, val: string) => {
    setFilters((prev) => prev.map((f, i) => (i === idx ? { ...f, [field]: val } : f)));
  };

  const removeFilter = (idx: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== idx));
  };

  const tmplList = Array.isArray(templates) ? templates : [];
  const selectedTmpl = tmplList.find((t) => t.id === selectedTemplate);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSelectedTemplate(""); setFilters([]); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileDown className="h-4 w-4 mr-1" />
          按模板导出
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>按模板导出</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Step 1: Data source */}
          <div>
            <label className="text-sm font-medium block mb-1.5">
              ① 选择数据源
            </label>
            <Select value={selectedTable} onValueChange={(v) => { setSelectedTable(v); setFilters([]); }}>
              <SelectTrigger>
                <SelectValue placeholder="选择要导出的数据表" />
              </SelectTrigger>
              <SelectContent>
                {tables
                  .filter((t) => t.status !== "DRAFT")
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.logicalName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Filters (collapsible) */}
          {selectedTable && userColumns.length > 0 && (
            <div>
              <button
                className="text-sm font-medium flex items-center gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => setShowFilters(!showFilters)}
              >
                <span>② 数据筛选</span>
                <span className="text-xs">
                  {showFilters ? "▲ 收起" : "▼ 展开"}
                  {filters.length > 0 && ` (${filters.length} 个条件)`}
                </span>
              </button>

              {showFilters && (
                <div className="mt-2 space-y-2 pl-2 border-l-2 border-muted">
                  {filters.map((f, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <div className="flex-1 grid grid-cols-3 gap-1.5">
                        <select
                          className="h-8 text-xs rounded-md border border-input bg-background px-2"
                          value={f.column}
                          onChange={(e) => updateFilter(idx, "column", e.target.value)}
                        >
                          {userColumns.map((c) => (
                            <option key={c.physicalName} value={c.physicalName}>
                              {c.logicalName}
                            </option>
                          ))}
                        </select>
                        <select
                          className="h-8 text-xs rounded-md border border-input bg-background px-2"
                          value={f.operator}
                          onChange={(e) => updateFilter(idx, "operator", e.target.value)}
                        >
                          {FILTER_OPERATORS.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                        {f.operator !== "isEmpty" && f.operator !== "isNotEmpty" ? (
                          <input
                            className="h-8 text-xs rounded-md border border-input bg-background px-2"
                            value={f.value}
                            onChange={(e) => updateFilter(idx, "value", e.target.value)}
                            placeholder="值"
                          />
                        ) : (
                          <div className="h-8 flex items-center text-xs text-muted-foreground px-2">
                            — 无需值 —
                          </div>
                        )}
                      </div>
                      <button
                        className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => removeFilter(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={addFilter}
                  >
                    + 添加筛选条件
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Template selection */}
          <div>
            <label className="text-sm font-medium block mb-1.5">
              ③ 选择导出模板
            </label>
            {tmplLoading ? (
              <div className="text-center py-4">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : !Array.isArray(templates) || templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无导出模板，请先在 Schema 页面创建</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {templates.map((tmpl) => {
                  const colCount =
                    tmpl.config.columns?.filter((c: ExportColumnConfig) => c.selected !== false).length || 0;
                  return (
                    <button
                      key={tmpl.id}
                      className={`w-full text-left p-2.5 border rounded-md transition-colors hover:bg-accent text-sm ${
                        selectedTemplate === tmpl.id ? "border-primary ring-1 ring-primary" : ""
                      }`}
                      onClick={() => setSelectedTemplate(tmpl.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{tmpl.templateName}</span>
                        <div className="flex gap-1">
                          {tmpl.config.logoImage && <Badge variant="secondary" className="text-[10px]">Logo</Badge>}
                          <Badge variant="outline" className="text-[10px]">
                            {tmpl.config.format?.toUpperCase() || "XLSX"}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {colCount} 列 | 表头{tmpl.config.headerPosition === "left" ? "左侧" : "顶部"}
                        {" | "}
                        {tmpl.config.filePattern || DEFAULT_PATTERN}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Export preview */}
          {selectedTable && selectedTmpl && (
            <div className="border-t pt-3">
              <div className="text-sm font-medium mb-1.5">导出预览</div>
              <div className="bg-muted/20 rounded-md p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">数据源:</span>
                  <span>{tableMeta?.logicalName || "—"}</span>
                </div>
                {filters.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">筛选条件:</span>
                    <span>{filters.length} 个</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">文件:</span>
                  <span className="font-mono">
                    {(selectedTmpl.config.filePattern || DEFAULT_PATTERN)
                      .replace(/{tableName}/g, tableMeta?.logicalName || "table")
                      .replace(/{date}/g, new Date().toISOString().slice(0, 10))
                    }
                    .{selectedTmpl.config.format === "csv" ? "csv" : "xlsx"}
                  </span>
                </div>
                {selectedTmpl.config.logoImage && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Logo:</span>
                    <span>已包含</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-3 border-t shrink-0">
          <div className="text-xs text-muted-foreground">
            {exporting ? "正在生成文件..." : "浏览器将自动下载文件"}
          </div>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline" size="sm" disabled={exporting}>取消</Button>
            </DialogClose>
            <Button size="sm" onClick={handleExport} disabled={!selectedTable || !selectedTemplate || exporting}>
              {exporting ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />导出中...</>
              ) : (
                <><FileDown className="h-4 w-4 mr-1" />导出</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
