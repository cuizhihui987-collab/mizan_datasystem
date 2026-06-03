"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Eye } from "lucide-react";
import Link from "next/link";

interface TableDetail {
  id: string;
  logicalName: string;
  physicalName: string;
  description: string | null;
  status: string;
  columns: Array<{
    id: string;
    logicalName: string;
    physicalName: string;
    dataType: string;
    isNullable: boolean;
    isPrimaryKey: boolean;
    isUnique: boolean;
    defaultValue: string | null;
    autoIncrement: boolean;
    ordinalPosition: number;
  }>;
}

export default function TableDesignPage() {
  const params = useParams();
  const router = useRouter();

  const { data: table, isLoading } = useQuery<TableDetail>({
    queryKey: ["table", params.tableId],
    queryFn: () => fetch(`/api/tables/${params.tableId}`).then((r) => r.json()),
  });

  const statusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "success" | "warning"> = {
      DRAFT: "secondary",
      CREATED: "success",
      IMPORTED: "success",
      MODIFIED: "warning",
    };
    const labels: Record<string, string> = {
      DRAFT: "草稿",
      CREATED: "已创建",
      IMPORTED: "已导入",
      MODIFIED: "已修改",
    };
    return <Badge variant={map[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!table) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">表不存在</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          返回
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{table.logicalName}</h1>
              {statusBadge(table.status)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {table.physicalName}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/schemas/${params.schemaId}/tables/${params.tableId}/ddl-designer`}>
              <Eye className="h-4 w-4 mr-1" />
              DDL 设计器
            </Link>
          </Button>
          {table.status !== "DRAFT" && (
            <Button variant="outline" asChild>
              <Link href={`/schemas/${params.schemaId}/tables/${params.tableId}/data`}>
                <Play className="h-4 w-4 mr-1" />
                查看数据
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>字段定义</CardTitle>
        </CardHeader>
        <CardContent>
          {table.columns.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>还没有定义字段</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href={`/schemas/${params.schemaId}/tables/${params.tableId}/ddl-designer`}>
                  前往 DDL 设计器添加字段
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">#</th>
                    <th className="text-left py-2 px-3 font-medium">逻辑名称</th>
                    <th className="text-left py-2 px-3 font-medium">物理名称</th>
                    <th className="text-left py-2 px-3 font-medium">数据类型</th>
                    <th className="text-center py-2 px-3 font-medium">主键</th>
                    <th className="text-center py-2 px-3 font-medium">非空</th>
                    <th className="text-center py-2 px-3 font-medium">唯一</th>
                    <th className="text-center py-2 px-3 font-medium">自增</th>
                    <th className="text-left py-2 px-3 font-medium">默认值</th>
                  </tr>
                </thead>
                <tbody>
                  {table.columns
                    .sort((a, b) => a.ordinalPosition - b.ordinalPosition)
                    .map((col) => (
                      <tr key={col.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3 text-muted-foreground">{col.ordinalPosition}</td>
                        <td className="py-2 px-3">{col.logicalName}</td>
                        <td className="py-2 px-3 font-mono text-xs">{col.physicalName}</td>
                        <td className="py-2 px-3"><Badge variant="outline">{col.dataType}</Badge></td>
                        <td className="py-2 px-3 text-center">
                          {col.isPrimaryKey && "✓"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {!col.isNullable && "✓"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {col.isUnique && "✓"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {col.autoIncrement && "✓"}
                        </td>
                        <td className="py-2 px-3 font-mono text-xs">{col.defaultValue || "-"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
