"use client";

import { useState } from "react";
import { useTableData } from "@/hooks/use-table-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

interface ColumnMeta {
  logicalName: string;
  physicalName: string;
  dataType: string;
}

interface DynamicDataTableProps {
  tableId: string;
}

export function DynamicDataTable({ tableId }: DynamicDataTableProps) {
  const {
    data,
    isLoading,
    error,
    page,
    setPage,
    sort,
    setSort,
    order,
    search,
    setSearch,
  } = useTableData(tableId);

  const columns: ColumnMeta[] = data?.columns || [];
  const rows = data?.rows || [];
  const total = data?.total || 0;
  const pageSize = data?.pageSize || 50;
  const totalPages = Math.ceil(total / pageSize);

  const SortIcon = ({ col }: { col: string }) => {
    if (sort !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return order === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  };

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-destructive">
          {error instanceof Error ? error.message : "加载数据失败"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索..."
            className="pl-9"
          />
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          新增行
        </Button>
      </div>

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
                <th className="text-left p-2 font-medium w-12">#</th>
                {columns.map((col) => (
                  <th
                    key={col.physicalName}
                    className="text-left p-2 font-medium cursor-pointer hover:bg-accent/50 whitespace-nowrap"
                    onClick={() => setSort(col.physicalName)}
                  >
                    <div className="flex items-center">
                      {col.logicalName}
                      <SortIcon col={col.physicalName} />
                    </div>
                  </th>
                ))}
                <th className="text-right p-2 font-medium w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 2}
                    className="p-8 text-center text-muted-foreground"
                  >
                    暂无数据
                  </td>
                </tr>
              ) : (
                rows.map((row: Record<string, unknown>, rowIdx: number) => (
                  <tr
                    key={row._id as string || rowIdx}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="p-2 text-muted-foreground text-xs">
                      {(page - 1) * pageSize + rowIdx + 1}
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col.physicalName}
                        className="p-2 truncate max-w-[200px]"
                      >
                        {formatCellValue(row[col.physicalName], col.dataType)}
                      </td>
                    ))}
                    <td className="p-2 text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        编辑
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            共 {total} 条，第 {page}/{totalPages} 页
          </p>
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
    </div>
  );
}

function formatCellValue(value: unknown, dataType: string): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-muted-foreground italic">NULL</span>;

  switch (dataType) {
    case "BOOLEAN":
      return value === 0 || value === "0" || value === false ? "否" : "是";
    case "DATE":
    case "DATETIME":
      return String(value);
    default:
      return String(value);
  }
}
