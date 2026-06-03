"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { toast } from "sonner";
import { LayoutDashboard, ExternalLink, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { HomeDashboardLayout } from "./home-dashboard-layout";

interface DashboardItem {
  id: string;
  name: string;
  schemaId: string;
  schema: { name: string };
  _count: { widgets: number };
}

interface DashboardDetail {
  id: string;
  name: string;
  schemaId: string;
  widgets: {
    id: string;
    title: string | null;
    tableId: string | null;
    chartType: string;
    config: string;
    positionX: number;
    positionY: number;
    width: number;
    height: number;
  }[];
}

interface SchemaItem {
  id: string;
  name: string;
}

export function HomeDashboardPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSchemaId, setCreateSchemaId] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch all dashboards
  const { data: dashboards, isLoading: listLoading } = useQuery<DashboardItem[]>({
    queryKey: ["user-dashboards"],
    queryFn: async () => {
      const res = await fetch("/api/dashboards");
      if (!res.ok) throw new Error("加载失败");
      return res.json();
    },
  });

  // Fetch schemas for create dialog
  const { data: schemas } = useQuery<SchemaItem[]>({
    queryKey: ["schemas"],
    queryFn: async () => {
      const res = await fetch("/api/schemas");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: showCreate,
  });

  // Fetch selected dashboard detail
  const { data: dashboardDetail, isLoading: detailLoading } = useQuery<DashboardDetail>({
    queryKey: ["dashboard-detail", selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const res = await fetch(`/api/dashboards/${selectedId}`);
      if (!res.ok) throw new Error("加载失败");
      return res.json();
    },
    enabled: !!selectedId,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName, schemaId: createSchemaId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "创建失败" }));
        throw new Error(err.error || "创建失败");
      }
      return res.json();
    },
    onSuccess: (newDash) => {
      queryClient.invalidateQueries({ queryKey: ["user-dashboards"] });
      setSelectedId(newDash.id);
      setShowCreate(false);
      setCreateName("");
      setCreateSchemaId("");
      toast.success("看板已创建");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "创建失败");
    },
  });

  // Rename mutation
  const renameMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/dashboards/${renameId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameName }),
      });
      if (!res.ok) throw new Error("重命名失败");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-dashboards"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-detail", renameId] });
      setRenameId(null);
      toast.success("看板已重命名");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "重命名失败");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/dashboards/${deleteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-dashboards"] });
      if (selectedId === deleteId) setSelectedId(null);
      setDeleteId(null);
      toast.success("看板已删除");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "删除失败");
    },
  });

  const selectedDashboard = dashboards?.find((d) => d.id === selectedId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            看板
          </CardTitle>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            新建
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dashboard selector */}
        {listLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : !dashboards || dashboards.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>还没有创建看板</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              创建第一个看板
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Select
                  value={selectedId || ""}
                  onValueChange={(v) => setSelectedId(v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择看板..." />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Group by schema */}
                    {Array.from(
                      new Map(
                        dashboards.map((d) => [d.schema.name, d.schema.name])
                      ).keys()
                    ).map((schemaName) => (
                      <div key={schemaName}>
                        <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
                          {schemaName}
                        </div>
                        {dashboards
                          .filter((d) => d.schema.name === schemaName)
                          .map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name} ({d._count.widgets})
                            </SelectItem>
                          ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedId && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="重命名"
                    onClick={() => {
                      const d = dashboards.find((x) => x.id === selectedId);
                      if (d) {
                        setRenameId(d.id);
                        setRenameName(d.name);
                      }
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    title="删除"
                    onClick={() => setDeleteId(selectedId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      if (selectedDashboard) {
                        router.push(
                          `/schemas/${selectedDashboard.schemaId}/dashboards/${selectedId}`
                        );
                      }
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    编辑
                  </Button>
                </div>
              )}
            </div>

            {/* Dashboard content */}
            {!selectedId ? (
              <div className="py-8 text-center text-muted-foreground border rounded-lg">
                <LayoutDashboard className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">选择一个看板查看图表</p>
              </div>
            ) : detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : dashboardDetail ? (
              <HomeDashboardLayout widgets={dashboardDetail.widgets} />
            ) : null}
          </>
        )}

        {/* Create dialog */}
        <Dialog open={showCreate} onOpenChange={(open) => !open && setShowCreate(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>新建看板</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium">看板名称</label>
                <Input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="输入看板名称"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">所属数据模型</label>
                <Select value={createSchemaId} onValueChange={setCreateSchemaId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="选择数据模型..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(schemas || []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                取消
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!createName.trim() || !createSchemaId || createMutation.isPending}
              >
                {createMutation.isPending ? "创建中..." : "创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename dialog */}
        <Dialog open={!!renameId} onOpenChange={(open) => !open && setRenameId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>重命名看板</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Input
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && renameName.trim()) {
                    renameMutation.mutate();
                  }
                }}
                placeholder="输入新名称"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenameId(null)}>
                取消
              </Button>
              <Button
                onClick={() => renameMutation.mutate()}
                disabled={!renameName.trim() || renameMutation.isPending}
              >
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除看板「{dashboards?.find((d) => d.id === deleteId)?.name}」吗？
                所有图表配置将被永久删除。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteId(null)}>
                取消
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                className="bg-destructive hover:bg-destructive/90"
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
