"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Plus, Table, Trash2, Pencil, FileSpreadsheet, BarChart3, Eye, Terminal, FileDown, BookOpen, GitBranch, LayoutDashboard } from "lucide-react";
import { ViewEditor } from "@/components/schema/view-editor";
import { ScriptEditor } from "@/components/schema/script-editor";
import { ExportTemplateEditor } from "@/components/schema/export-template-editor";
import Link from "next/link";
import { PipelineList } from "@/components/pipeline/pipeline-list";
import { DashboardList } from "@/components/dashboard/dashboard-list";

interface TableDef {
  id: string;
  logicalName: string;
  physicalName: string;
  status: string;
  color: string | null;
  _count: { columns: number };
}

interface SchemaDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  tables: TableDef[];
  user?: { name: string | null; email: string | null };
}

export default function SchemaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deletingTable, setDeletingTable] = useState<TableDef | null>(null);
  const [renamingTable, setRenamingTable] = useState<TableDef | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const { data: schema, isLoading } = useQuery<SchemaDetail>({
    queryKey: ["schema", params.schemaId],
    queryFn: async () => {
      const res = await fetch(`/api/schemas/${params.schemaId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "请求失败" }));
        throw new Error(err.error || "数据模型不存在");
      }
      return res.json();
    },
  });

  const colorMutation = useMutation({
    mutationFn: async ({ tableId, color }: { tableId: string; color: string | null }) => {
      const res = await fetch(`/api/tables/${tableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      });
      if (!res.ok) throw new Error("更新颜色失败");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schema", params.schemaId] });
    },
  });

  const renameTableMutation = useMutation({
    mutationFn: async ({ tableId, logicalName }: { tableId: string; logicalName: string }) => {
      const res = await fetch(`/api/tables/${tableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logicalName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "重命名失败");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schema", params.schemaId] });
      toast.success("表名已更新");
      setRenamingTable(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "重命名失败");
    },
  });

  const deleteTableMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const res = await fetch(`/api/tables/${tableId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schema", params.schemaId] });
      toast.success("表已删除");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "删除失败");
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
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span>{schema.user?.name || schema.user?.email || "未知用户"}</span>
            <span className="text-muted-foreground/50">|</span>
            <span>创建于 {new Date(schema.createdAt).toLocaleDateString("zh-CN")}</span>
          </div>
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
          <TabsTrigger value="api-docs">
            <BookOpen className="h-3.5 w-3.5 mr-1" />
            API 文档
          </TabsTrigger>
          <TabsTrigger value="pipelines">
            <GitBranch className="h-3.5 w-3.5 mr-1" />
            ETL
          </TabsTrigger>
          <TabsTrigger value="dashboards">
            <LayoutDashboard className="h-3.5 w-3.5 mr-1" />
            看板
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
                <Card key={table.id} className="group">
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <div className="relative group/color">
                          <button
                            className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0 cursor-pointer"
                            style={{ backgroundColor: table.color || "#e5e7eb" }}
                            onClick={() => {
                              const input = document.createElement("input");
                              input.type = "color";
                              input.value = table.color || "#3B82F6";
                              input.oninput = () => colorMutation.mutate({ tableId: table.id, color: input.value });
                              input.click();
                            }}
                            title="标记颜色"
                          />
                          {table.color && (
                            <button
                              className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive text-destructive-foreground text-[8px] leading-none flex items-center justify-center opacity-0 group-hover/color:opacity-100 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); colorMutation.mutate({ tableId: table.id, color: null }); }}
                              title="移除颜色"
                            >×</button>
                          )}
                        </div>
                        {table.logicalName}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            setRenamingTable(table);
                            setRenameValue(table.logicalName);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </CardTitle>
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
                        <AlertDialog open={deletingTable?.id === table.id} onOpenChange={(open) => !open && setDeletingTable(null)}>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => setDeletingTable(table)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>确认删除</AlertDialogTitle>
                              <AlertDialogDescription>
                                确定要删除表「{table.logicalName}」吗？此操作不可撤销，所有数据将被永久删除。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setDeletingTable(null)}>取消</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  setDeletingTable(null);
                                  deleteTableMutation.mutate(table.id);
                                }}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                删除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
        <TabsContent value="api-docs" className="space-y-4">
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">查看基于表结构自动生成的 RESTful API 文档</p>
              <Button asChild>
                <Link href={`/schemas/${params.schemaId}/api-docs`}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  查看 API 文档
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pipelines" className="space-y-4">
          <PipelineList schemaId={params.schemaId as string} />
        </TabsContent>
        <TabsContent value="dashboards" className="space-y-4">
          <DashboardList schemaId={params.schemaId as string} />
        </TabsContent>
      </Tabs>
      <Dialog open={!!renamingTable} onOpenChange={(open) => { if (!open) setRenamingTable(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名表</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && renamingTable && renameValue.trim()) {
                  renameTableMutation.mutate({ tableId: renamingTable.id, logicalName: renameValue.trim() });
                }
              }}
              placeholder="输入新的表名"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingTable(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (renamingTable && renameValue.trim()) {
                  renameTableMutation.mutate({ tableId: renamingTable.id, logicalName: renameValue.trim() });
                }
              }}
              disabled={!renameValue.trim() || renameTableMutation.isPending}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
