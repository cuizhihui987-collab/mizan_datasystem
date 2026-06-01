"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Table, Trash2, FileSpreadsheet, BarChart3, Eye, Terminal, FileDown } from "lucide-react";
import { ViewEditor } from "@/components/schema/view-editor";
import { ScriptEditor } from "@/components/schema/script-editor";
import { ExportTemplateEditor } from "@/components/schema/export-template-editor";
import Link from "next/link";

interface TableDef {
  id: string;
  logicalName: string;
  physicalName: string;
  status: string;
  _count: { columns: number };
}

interface SchemaDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  tables: TableDef[];
}

export default function SchemaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: schema, isLoading } = useQuery<SchemaDetail>({
    queryKey: ["schema", params.schemaId],
    queryFn: () => fetch(`/api/schemas/${params.schemaId}`).then((r) => r.json()),
  });

  const deleteTableMutation = useMutation({
    mutationFn: (tableId: string) =>
      fetch(`/api/tables/${tableId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schema", params.schemaId] });
    },
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
        <Skeleton className="h-4 w-72" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">数据模型不存在</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/schemas")}>
          返回
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/schemas")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{schema.name}</h1>
          {schema.description && (
            <p className="text-muted-foreground mt-1">{schema.description}</p>
          )}
        </div>
        <Button variant="outline" asChild>
          <Link href={`/schemas/${params.schemaId}/import`}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            导入数据
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="tables">
        <TabsList>
          <TabsTrigger value="tables">数据表</TabsTrigger>
          <TabsTrigger value="views">
            <Eye className="h-3.5 w-3.5 mr-1" />
            视图
          </TabsTrigger>
          <TabsTrigger value="scripts">
            <Terminal className="h-3.5 w-3.5 mr-1" />
            脚本
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileDown className="h-3.5 w-3.5 mr-1" />
            导出模板
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tables" className="space-y-4">
          <div className="flex justify-end">
            <Button asChild>
              <Link href={`/schemas/${params.schemaId}/tables/new`}>
                <Plus className="h-4 w-4 mr-2" />
                新建表
              </Link>
            </Button>
          </div>

          {schema.tables.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Table className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">该模型还没有数据表</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href={`/schemas/${params.schemaId}/tables/new`}>
                    创建第一个表
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {schema.tables.map((table) => (
                <Card key={table.id}>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{table.logicalName}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {table.physicalName}
                      </p>
                    </div>
                    {statusBadge(table.status)}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {table._count.columns} 个字段
                      </span>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/schemas/${params.schemaId}/tables/${table.id}`}>
                            设计
                          </Link>
                        </Button>
                        {table.status !== "DRAFT" && (
                          <>
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/schemas/${params.schemaId}/tables/${table.id}/data`}>
                                数据
                              </Link>
                            </Button>
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/schemas/${params.schemaId}/tables/${table.id}/visualize`}>
                                图表
                              </Link>
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTableMutation.mutate(table.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="views" className="space-y-4">
          <ViewEditor schemaId={params.schemaId as string} />
        </TabsContent>
        <TabsContent value="scripts" className="space-y-4">
          <ScriptEditor schemaId={params.schemaId as string} />
        </TabsContent>
        <TabsContent value="templates" className="space-y-4">
          <ExportTemplateEditor schemaId={params.schemaId as string} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
