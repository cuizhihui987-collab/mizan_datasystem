"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, LayoutDashboard, Trash2, Loader2 } from "lucide-react";

interface Dashboard {
  id: string;
  name: string;
  createdAt: string;
  _count: { widgets: number };
}

export function DashboardList({ schemaId }: { schemaId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: dashboards, isLoading } = useQuery<Dashboard[]>({
    queryKey: ["dashboards", schemaId],
    queryFn: async () => {
      const res = await fetch(`/api/schemas/${schemaId}/dashboards`);
      if (!res.ok) throw new Error("加载失败");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/schemas/${schemaId}/dashboards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "创建失败");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["dashboards", schemaId] });
      setShowCreate(false);
      setNewName("");
      toast.success("看板创建成功");
      router.push(`/schemas/${schemaId}/dashboards/${data.id}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "创建失败");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/schemas/${schemaId}/dashboards/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboards", schemaId] });
      toast.success("看板已删除");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "删除失败");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新建看板
        </Button>
      </div>

      {(!dashboards || dashboards.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <LayoutDashboard className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>暂无看板</p>
            <p className="text-sm mt-1">创建看板来汇总多个图表</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {dashboards.map((d) => (
            <Card
              key={d.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors group"
            >
              <CardContent
                className="flex items-center justify-between py-4"
                onClick={() => router.push(`/schemas/${schemaId}/dashboards/${d.id}`)}
              >
                <div className="flex items-center gap-3">
                  <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <span className="font-medium">{d.name}</span>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {d._count.widgets} 个图表 · 创建于 {new Date(d.createdAt).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                </div>
              </CardContent>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <AlertDialog open={deleteId === d.id} onOpenChange={(open) => !open && setDeleteId(null)}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(d.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认删除</AlertDialogTitle>
                      <AlertDialogDescription>
                        确定要删除看板「{d.name}」吗？所有图表配置将被删除。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setDeleteId(null)}>取消</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(d.id)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建看板</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium">名称</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例如：运营数据概览"
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              取消
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newName.trim() || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
