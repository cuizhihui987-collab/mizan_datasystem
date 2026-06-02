"use client";

import { useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTableData } from "@/hooks/use-table-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Pencil,
  Trash2,
  Download,
} from "lucide-react";

import { BatchImportDialog } from "@/components/data/batch-import-dialog";
import { FilterDialog, FilterBadges } from "@/components/data/filter-dialog";
import { ExportWithTemplateDialog } from "@/components/schema/export-template-editor";
import { PermissionDialog } from "@/components/data/permission-dialog";

interface ForeignKeyInfo {
  constraintName: string;
  referencedTableId: string;
  referencedTableName: string;
  referencedPhysicalName: string;
}

interface TargetFKInfo {
  constraintName: string;
  sourceTableId: string;
  sourceTableName: string;
  sourcePhysicalName: string;
}

interface ColumnMeta {
  logicalName: string;
  physicalName: string;
  dataType: string;
  foreignKeyInfo: ForeignKeyInfo | null;
}

interface RelatedData {
  rowId: string;
  currentRow: Record<string, unknown>;
  sourceFKs: Array<{
    constraintName: string;
    referencedTableId: string;
    referencedTableName: string;
    columns: Array<{
      sourceColumn: string;
      sourceValue: unknown;
      refData: Record<string, unknown> | null;
    }>;
  }>;
  targetFKs: Array<{
    constraintName: string;
    sourceTableId: string;
    sourceTableName: string;
    referencingCount: number;
  }>;
}

interface DynamicDataTableProps {
  tableId: string;
}

export function DynamicDataTable({ tableId }: DynamicDataTableProps) {
  const queryClient = useQueryClient();
  const schemaId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const parts = window.location.pathname.split("/");
    const idx = parts.indexOf("schemas");
    return idx !== -1 ? parts[idx + 1] : "";
  }, []);
  const {
    data,
    isLoading,
    error,
    page,
    setPage,
    pageSize,
    setPageSize,
    sort,
    setSort,
    order,
    search,
    setSearch,
    filters,
    setFilters,
  } = useTableData(tableId);

  const columns: ColumnMeta[] = data?.columns || [];
  const rows = data?.rows || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isOwner = data?.permissions?.isOwner ?? true;
  const canInsert = data?.permissions?.canInsert ?? true;
  const canUpdate = data?.permissions?.canUpdate ?? true;
  const canDelete = data?.permissions?.canDelete ?? true;

  // Row selection
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Inline editing
  const [editingCell, setEditingCell] = useState<{ rowId: number; col: string; value: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: "single"; id: number } | { type: "batch" } | null>(null);

  // Batch update dialog
  const [batchUpdateOpen, setBatchUpdateOpen] = useState(false);

  // Row edit dialog
  const [editingRow, setEditingRow] = useState<{ rowId: number; data: Record<string, unknown> } | null>(null);

  // Related data dialog
  const [relatedRow, setRelatedRow] = useState<{ rowId: number; col: ColumnMeta } | null>(null);
  const [relatedData, setRelatedData] = useState<RelatedData | null>(null);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: "xlsx" | "csv") => {
    setExporting(true);
    try {
      const res = await fetch(`/api/tables/${tableId}/export?format=${format}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "导出失败");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)/);
      const filename = filenameMatch
        ? decodeURIComponent(filenameMatch[1])
        : `export.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`导出完成：${filename}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["table-data", tableId] });
  }, [queryClient, tableId]);

  const userColumns = columns.filter(
    (c) => !["_id", "_created_at", "_updated_at"].includes(c.physicalName)
  );

  // --- Selection ---
  const allVisibleSelected = rows.length > 0 && rows.every((r: Record<string, unknown>) => selectedRows.has(Number(r._id)));

  const toggleSelectRow = (id: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedRows(new Set());
    } else {
      const ids = rows.map((r: Record<string, unknown>) => Number(r._id)).filter(Boolean);
      setSelectedRows(new Set(ids));
    }
  };

  // --- Inline Editing ---
  const startEditing = (rowId: number, col: string, currentValue: unknown) => {
    // Don't edit system fields
    if (["_id", "_created_at", "_updated_at"].includes(col)) return;
    setEditingCell({ rowId, col, value: String(currentValue ?? "") });
    setEditValue(String(currentValue ?? ""));
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    const { rowId, col, value: oldValue } = editingCell;
    const newValue = editValue;
    if (newValue === oldValue) {
      setEditingCell(null);
      return;
    }

    try {
      const body: Record<string, unknown> = { _id: rowId };
      const colMeta = userColumns.find((c) => c.physicalName === col);
      if (colMeta) {
        if (["INTEGER", "BIGINT"].includes(colMeta.dataType)) {
          body[col] = newValue === "" ? null : parseInt(newValue, 10);
        } else if (["FLOAT", "DOUBLE", "DECIMAL"].includes(colMeta.dataType)) {
          body[col] = newValue === "" ? null : parseFloat(newValue);
        } else {
          body[col] = newValue;
        }
      } else {
        body[col] = newValue;
      }

      const res = await fetch(`/api/tables/${tableId}/data`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "更新失败");
      }

      setEditingCell(null);
      invalidate();
      toast.success("已更新");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失败");
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
  };

  // --- Delete ---
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      let res: Response;
      if (deleteTarget.type === "single") {
        res = await fetch(`/api/tables/${tableId}/data`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ _id: deleteTarget.id }),
        });
      } else {
        const ids = Array.from(selectedRows);
        res = await fetch(`/api/tables/${tableId}/data`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "删除失败");
      }

      const result = await res.json();
      setDeleteTarget(null);
      setSelectedRows(new Set());
      invalidate();
      toast.success(`已删除 ${result.deleted || 1} 行`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    }
  };

  // --- Batch Update ---
  const [batchUpdateCol, setBatchUpdateCol] = useState("");
  const [batchUpdateVal, setBatchUpdateVal] = useState("");

  const handleBatchUpdate = async () => {
    if (!batchUpdateCol) return;
    const ids = Array.from(selectedRows);
    try {
      const colMeta = userColumns.find((c) => c.physicalName === batchUpdateCol);
      let value: unknown = batchUpdateVal;
      if (colMeta) {
        if (["INTEGER", "BIGINT"].includes(colMeta.dataType)) {
          value = batchUpdateVal === "" ? null : parseInt(batchUpdateVal, 10);
        } else if (["FLOAT", "DOUBLE", "DECIMAL"].includes(colMeta.dataType)) {
          value = batchUpdateVal === "" ? null : parseFloat(batchUpdateVal);
        }
      }

      const res = await fetch(`/api/tables/${tableId}/data`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, column: batchUpdateCol, value }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "批量更新失败");
      }

      setBatchUpdateOpen(false);
      setBatchUpdateCol("");
      setBatchUpdateVal("");
      setSelectedRows(new Set());
      invalidate();
      toast.success(`已更新 ${ids.length} 行`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "批量更新失败");
    }
  };

  // --- Helpers ---
  const inputTypeFor = (dataType: string) => {
    switch (dataType) {
      case "INTEGER":
      case "BIGINT":
      case "FLOAT":
      case "DOUBLE":
      case "DECIMAL":
        return "number";
      case "DATE":
        return "date";
      case "DATETIME":
        return "datetime-local";
      default:
        return "text";
    }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sort !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return order === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  };

  if (error) {
    const errMsg = error instanceof Error ? error.message : "加载数据失败";
    const needsReexec = errMsg.includes("物理表不存在");
    return (
      <div className="py-12 text-center space-y-4">
        <p className={needsReexec ? "text-amber-600 font-medium" : "text-destructive"}>
          {errMsg}
        </p>
        {needsReexec && (
          <Button
            variant="outline"
            onClick={() =>
              window.location.href =
                `/schemas/${window.location.pathname.split("/")[2]}/tables/${tableId}/ddl-designer`
            }
          >
            前往 DDL 设计器重新建表
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOwner && (
            <PermissionDialog tableId={tableId} tableName={data?.tableName || "数据表"} />
          )}
          <FilterDialog
            columns={columns}
            value={filters}
            onChange={setFilters}
          />
          <ExportButton onExport={handleExport} loading={exporting} />
          {schemaId && <ExportWithTemplateDialog schemaId={schemaId} tableId={tableId} />}
          {canInsert && (
            <BatchImportDialog
              tableId={tableId}
              tableColumns={columns}
              onSuccess={invalidate}
            />
          )}
          {canInsert && (
            <AddRowDialog
              tableId={tableId}
              columns={columns}
              onSuccess={invalidate}
            />
          )}
          {canUpdate && editingRow && (
            <EditRowDialog
              tableId={tableId}
              columns={columns}
              rowData={editingRow.data}
              rowId={editingRow.rowId}
              onSuccess={() => {
                setEditingRow(null);
                invalidate();
              }}
              onClose={() => setEditingRow(null)}
            />
          )}
        </div>
      </div>

      {/* Active filter badges */}
      <FilterBadges
        filters={filters}
        columns={columns}
        onRemove={(idx) => {
          const updated = { ...filters! };
          updated.conditions = updated.conditions.filter((_, i) => i !== idx);
          if (updated.conditions.length === 0) {
            setFilters(undefined);
          } else {
            setFilters(updated);
          }
        }}
        onClear={() => setFilters(undefined)}
      />

      {/* Data Table */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2 font-medium w-10">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="全选"
                  />
                </th>
                <th className="text-left p-2 font-medium w-12">#</th>
                {columns.map((col) => (
                  <th
                    key={col.physicalName}
                    className="text-left p-2 font-medium cursor-pointer hover:bg-accent/50 whitespace-nowrap"
                    onClick={() => setSort(col.physicalName)}
                  >
                    <div className="flex items-center gap-1">
                      {col.foreignKeyInfo && (
                        <span className="text-[10px] text-blue-500 font-bold" title={`关联: ${col.foreignKeyInfo.referencedTableName}`}>🔗</span>
                      )}
                      {col.logicalName}
                      <SortIcon col={col.physicalName} />
                    </div>
                  </th>
                ))}
                <th className="text-right p-2 font-medium w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 3}
                    className="p-8 text-center text-muted-foreground"
                  >
                    暂无数据
                  </td>
                </tr>
              ) : (
                rows.map((row: Record<string, unknown>, rowIdx: number) => {
                  const rowId = Number(row._id);
                  return (
                    <tr
                      key={rowId || rowIdx}
                      className={`border-b last:border-0 hover:bg-muted/30 ${
                        selectedRows.has(rowId) ? "bg-muted/20" : ""
                      }`}
                    >
                      <td className="p-2">
                        <Checkbox
                          checked={selectedRows.has(rowId)}
                          onCheckedChange={() => toggleSelectRow(rowId)}
                          aria-label={`选择第 ${rowIdx + 1} 行`}
                        />
                      </td>
                      <td className="p-2 text-muted-foreground text-xs">
                        {(page - 1) * pageSize + rowIdx + 1}
                      </td>
                      {columns.map((col) => {
                        const isEditing =
                          editingCell?.rowId === rowId &&
                          editingCell?.col === col.physicalName;
                        return (
                          <td
                            key={col.physicalName}
                            className={`p-2 truncate max-w-[200px] ${
                              !["_id", "_created_at", "_updated_at"].includes(
                                col.physicalName
                              )
                                ? "cursor-pointer"
                                : ""
                            }`}
                            onDoubleClick={() =>
                              canUpdate
                                ? startEditing(
                                    rowId,
                                    col.physicalName,
                                    row[col.physicalName]
                                  )
                                : undefined
                            }
                          >
                            {isEditing ? (
                              <Input
                                type={inputTypeFor(col.dataType)}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    saveEdit();
                                  }
                                  if (e.key === "Escape") {
                                    cancelEdit();
                                  }
                                }}
                                onBlur={() => {
                                  // Small delay so button clicks don't trigger blur before Enter
                                  setTimeout(() => {
                                    if (editingCell) cancelEdit();
                                  }, 150);
                                }}
                                className="h-7 text-sm px-1"
                                autoFocus
                              />
                            ) : col.foreignKeyInfo && row[col.physicalName] !== null && row[col.physicalName] !== undefined ? (
                              <button
                                className="text-blue-600 hover:text-blue-800 hover:underline text-left w-full truncate"
                                onClick={() => {
                                  setRelatedRow({ rowId, col });
                                  setLoadingRelated(true);
                                  fetch(`/api/tables/${tableId}/related-data/${row[col.physicalName]}`)
                                    .then((r) => r.json())
                                    .then((data) => {
                                      setRelatedData(data);
                                      setLoadingRelated(false);
                                    })
                                    .catch(() => setLoadingRelated(false));
                                }}
                                title={`查看关联数据: ${col.foreignKeyInfo.referencedTableName}`}
                              >
                                {formatCellValue(row[col.physicalName], col.dataType)}
                              </button>
                            ) : (
                              formatCellValue(
                                row[col.physicalName],
                                col.dataType
                              )
                            )}
                          </td>
                        );
                      })}
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setEditingRow({ rowId, data: { ...row } })}
                              title="编辑行"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget({ type: "single", id: rowId })}
                              title="删除"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>共 {total} 条</span>
            <span className="text-muted-foreground/50">|</span>
            <div className="flex items-center gap-1.5">
              <span>每页</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-7 w-[70px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100, 200].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>条</span>
            </div>
            <span className="text-muted-foreground/50">|</span>
            <span>
              第 {page}/{totalPages} 页
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(1)}
              disabled={page <= 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 min-w-[4rem] text-center">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Batch action bar */}
      {selectedRows.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-card border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 text-sm">
          <span className="text-muted-foreground whitespace-nowrap">
            已选择 <span className="font-bold text-foreground">{selectedRows.size}</span> 行
          </span>
          <div className="h-4 w-px bg-border" />
          {canUpdate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBatchUpdateOpen(true)}
            >
              批量更新
            </Button>
          )}
          {canDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteTarget({ type: "batch" })}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              批量删除
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedRows(new Set())}
          >
            取消选择
          </Button>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "single"
                ? "确定要删除该行数据吗？此操作不可撤销。"
                : `确定要删除已选择的 ${selectedRows.size} 行数据吗？此操作不可撤销。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch update dialog */}
      <Dialog open={batchUpdateOpen} onOpenChange={setBatchUpdateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>批量更新</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              将已选择的 <strong>{selectedRows.size}</strong> 行中的指定字段更新为统一值
            </p>
            <div>
              <label className="text-sm font-medium block mb-1">
                选择字段
              </label>
              <Select value={batchUpdateCol} onValueChange={setBatchUpdateCol}>
                <SelectTrigger>
                  <SelectValue placeholder="选择要更新的字段" />
                </SelectTrigger>
                <SelectContent>
                  {userColumns.map((col) => (
                    <SelectItem key={col.physicalName} value={col.physicalName}>
                      {col.logicalName} ({col.dataType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {batchUpdateCol && (
              <div>
                <label className="text-sm font-medium block mb-1">
                  新值
                </label>
                <Input
                  type={inputTypeFor(
                    userColumns.find((c) => c.physicalName === batchUpdateCol)
                      ?.dataType || "text"
                  )}
                  value={batchUpdateVal}
                  onChange={(e) => setBatchUpdateVal(e.target.value)}
                  placeholder="输入新值"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button onClick={handleBatchUpdate} disabled={!batchUpdateCol}>
              更新 {selectedRows.size} 行
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Target FKs display */}
      {data?.targetForeignKeys && data.targetForeignKeys.length > 0 && (
        <div className="border rounded-md p-3 bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground mb-1">被以下表引用</p>
          <div className="flex flex-wrap gap-2">
            {data.targetForeignKeys.map((tfk: TargetFKInfo, i: number) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                {tfk.sourceTableName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Related data dialog */}
      <Dialog open={!!relatedRow} onOpenChange={(open) => { if (!open) { setRelatedRow(null); setRelatedData(null); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              关联数据
              {relatedRow && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {relatedRow.col.logicalName} → {relatedRow.col.foreignKeyInfo?.referencedTableName}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4">
            {loadingRelated ? (
              <div className="py-8 text-center text-sm text-muted-foreground">加载中...</div>
            ) : relatedData ? (
              <>
                {relatedData.sourceFKs.length === 0 && relatedData.targetFKs.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">无关联数据</p>
                ) : (
                  <>
                    {relatedData.sourceFKs.map((sfk, i) => (
                      <div key={i} className="border rounded-md overflow-hidden">
                        <div className="bg-muted/50 px-3 py-1.5 text-sm font-medium flex items-center gap-2">
                          引用: {sfk.referencedTableName}
                          <span className="text-xs text-muted-foreground">({sfk.constraintName})</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b bg-muted/20">
                                {sfk.columns[0]?.refData && Object.keys(sfk.columns[0].refData).map((key) => (
                                  <th key={key} className="text-left p-2 font-medium whitespace-nowrap">{key}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sfk.columns.map((col, ci) => (
                                <tr key={ci} className="border-b last:border-0">
                                  {col.refData ? Object.values(col.refData).map((val, vi) => (
                                    <td key={vi} className="p-2 truncate max-w-[200px]">{String(val ?? "")}</td>
                                  )) : (
                                    <td className="p-2 text-muted-foreground italic">无匹配数据</td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                    {relatedData.targetFKs.map((tfk, i) => (
                      <div key={i} className="border rounded-md p-3 text-sm">
                        <span className="font-medium">{tfk.sourceTableName}</span>
                        <span className="text-muted-foreground ml-2">
                          有 {tfk.referencingCount} 行数据引用当前行
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">加载失败</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isImageUrl(val: string): boolean {
  return /^https?:\/\/.+\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(val) || /^data:image\//.test(val);
}

function formatCellValue(value: unknown, dataType: string): React.ReactNode {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground italic">NULL</span>;

  switch (dataType) {
    case "BOOLEAN":
      return value === 0 || value === "0" || value === false ? "否" : "是";
    case "DATE":
    case "DATETIME":
      return String(value);
    default: {
      const str = String(value);
      if (isImageUrl(str)) {
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={str} alt="" className="max-h-10 rounded object-contain cursor-pointer hover:opacity-80"
            onClick={(e) => { e.stopPropagation(); window.open(str, "_blank"); }}
          />
        );
      }
      return str;
    }
  }
}

function ExportButton({
  onExport,
  loading,
}: {
  onExport: (format: "xlsx" | "csv") => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={() => setOpen(!open)}
      >
        <Download className="h-4 w-4 mr-1" />
        {loading ? "导出中..." : "导出"}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-card border rounded-md shadow-lg py-1 min-w-[120px]">
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              onClick={() => {
                setOpen(false);
                onExport("xlsx");
              }}
            >
              导出 Excel (.xlsx)
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              onClick={() => {
                setOpen(false);
                onExport("csv");
              }}
            >
              导出 CSV (.csv)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AddRowDialog({
  tableId,
  columns,
  onSuccess,
}: {
  tableId: string;
  columns: ColumnMeta[];
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userColumns = columns.filter(
    (c) => !["_id", "_created_at", "_updated_at"].includes(c.physicalName)
  );

  const handleChange = (physicalName: string, value: string) => {
    setFormData((prev) => ({ ...prev, [physicalName]: value }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      for (const col of userColumns) {
        const val = formData[col.physicalName] || "";
        if (val === "") continue;
        if (col.dataType === "INTEGER" || col.dataType === "BIGINT") {
          body[col.physicalName] = parseInt(val, 10);
        } else if (col.dataType === "FLOAT" || col.dataType === "DOUBLE") {
          body[col.physicalName] = parseFloat(val);
        } else {
          body[col.physicalName] = val;
        }
      }

      const res = await fetch(`/api/tables/${tableId}/data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "添加失败");
      }

      setOpen(false);
      setFormData({});
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setSaving(false);
    }
  };

  const inputType = (dataType: string) => {
    switch (dataType) {
      case "INTEGER":
      case "BIGINT":
        return "number";
      case "FLOAT":
      case "DOUBLE":
        return "number";
      case "DATE":
        return "date";
      case "DATETIME":
        return "datetime-local";
      default:
        return "text";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          新增行
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>新增行</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 overflow-y-auto max-h-[55vh]">
          {userColumns.length === 0 ? (
            <p className="text-sm text-muted-foreground">没有可编辑的字段</p>
          ) : (
            userColumns.map((col) => (
              <div key={col.physicalName}>
                <label className="text-sm font-medium block mb-1">
                  {col.logicalName}
                  <span className="text-xs text-muted-foreground ml-2">
                    ({col.dataType})
                  </span>
                </label>
                <Input
                  type={inputType(col.dataType)}
                  value={formData[col.physicalName] || ""}
                  onChange={(e) => handleChange(col.physicalName, e.target.value)}
                  placeholder={`输入 ${col.logicalName}`}
                />
              </div>
            ))
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 shrink-0">
          <DialogClose asChild>
            <Button variant="outline" disabled={saving}>
              取消
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "添加中..." : "添加"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditRowDialog({
  tableId,
  columns,
  rowData,
  rowId,
  onSuccess,
  onClose,
}: {
  tableId: string;
  columns: ColumnMeta[];
  rowData: Record<string, unknown>;
  rowId: number;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const col of columns) {
      if (["_id", "_created_at", "_updated_at"].includes(col.physicalName)) continue;
      initial[col.physicalName] = rowData[col.physicalName] === null || rowData[col.physicalName] === undefined
        ? "" : String(rowData[col.physicalName]);
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userColumns = columns.filter(
    (c) => !["_id", "_created_at", "_updated_at"].includes(c.physicalName)
  );

  const handleChange = (physicalName: string, value: string) => {
    setFormData((prev) => ({ ...prev, [physicalName]: value }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { _id: rowId };
      for (const col of userColumns) {
        const val = formData[col.physicalName] ?? "";
        if (val === "" && rowData[col.physicalName] === null) continue;
        if (col.dataType === "INTEGER" || col.dataType === "BIGINT") {
          body[col.physicalName] = val === "" ? null : parseInt(val, 10);
        } else if (col.dataType === "FLOAT" || col.dataType === "DOUBLE") {
          body[col.physicalName] = val === "" ? null : parseFloat(val);
        } else {
          body[col.physicalName] = val;
        }
      }

      const res = await fetch(`/api/tables/${tableId}/data`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "保存失败");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const inputType = (dataType: string) => {
    switch (dataType) {
      case "INTEGER":
      case "BIGINT":
      case "FLOAT":
      case "DOUBLE":
        return "number";
      case "DATE":
        return "date";
      case "DATETIME":
        return "datetime-local";
      default:
        return "text";
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>编辑行 #{rowId}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 overflow-y-auto max-h-[55vh]">
          {userColumns.length === 0 ? (
            <p className="text-sm text-muted-foreground">没有可编辑的字段</p>
          ) : (
            userColumns.map((col) => (
              <div key={col.physicalName}>
                <label className="text-sm font-medium block mb-1">
                  {col.logicalName}
                  <span className="text-xs text-muted-foreground ml-2">
                    ({col.dataType})
                  </span>
                </label>
                <Input
                  type={inputType(col.dataType)}
                  value={formData[col.physicalName] || ""}
                  onChange={(e) => handleChange(col.physicalName, e.target.value)}
                  placeholder={`输入 ${col.logicalName}`}
                />
              </div>
            ))
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
