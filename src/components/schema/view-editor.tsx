"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { toast } from "sonner";
import { Plus, Play, Trash2, Eye, Pencil } from "lucide-react";

interface View {
  id: string;
  viewName: string;
  sql: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function ViewEditor({ schemaId }: { schemaId: string }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingView, setEditingView] = useState<View | null>(null);
  const [viewName, setViewName] = useState("");
  const [sql, setSql] = useState("");
  const [description, setDescription] = useState("");
  const [executing, setExecuting] = useState<string | null>(null);
  const [previewSql, setPreviewSql] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<Record<string, unknown>[] | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const { data: views, isLoading } = useQuery<View[]>({
    queryKey: ["views", schemaId],
    queryFn: () => fetch(`/api/schemas/${schemaId}/views`).then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: { viewName: string; sql: string; description?: string }) =>
      fetch(`/api/schemas/${schemaId}/views`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("视图已创建");
        setDialogOpen(false);
        resetForm();
        queryClient.invalidateQueries({ queryKey: ["views", schemaId] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (viewId: string) =>
      fetch(`/api/schemas/${schemaId}/views/${viewId}`, {
        method: "DELETE",
      }).then((r) => r.json()),
    onSuccess: () => {
      toast.success("视图已删除");
      queryClient.invalidateQueries({ queryKey: ["views", schemaId] });
    },
  });

  const executeView = async (view: View) => {
    setExecuting(view.id);
    try {
      const res = await fetch(
        `/api/schemas/${schemaId}/views/${view.id}/execute`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "执行失败");
      } else {
        toast.success(data.message);
        queryClient.invalidateQueries({ queryKey: ["views", schemaId] });
      }
    } catch {
      toast.error("执行失败");
    } finally {
      setExecuting(null);
    }
  };

  const previewQuery = async () => {
    if (!previewSql?.trim()) return;
    setPreviewing(true);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: previewSql }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "查询失败");
      } else {
        setPreviewResult(data.results || []);
      }
    } catch {
      toast.error("查询失败");
    } finally {
      setPreviewing(false);
    }
  };

  const resetForm = () => {
    setViewName("");
    setSql("");
    setDescription("");
    setEditingView(null);
  };

  const openEdit = (view: View) => {
    setEditingView(view);
    setViewName(view.viewName);
    setSql(view.sql);
    setDescription(view.description || "");
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editingView) {
      // Update
      fetch(`/api/schemas/${schemaId}/views/${editingView.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewName, sql, description }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            toast.error(data.error);
          } else {
            toast.success("视图已更新");
            setDialogOpen(false);
            resetForm();
            queryClient.invalidateQueries({ queryKey: ["views", schemaId] });
          }
        });
    } else {
      createMutation.mutate({ viewName, sql, description });
    }
  };

  if (isLoading) {
    return <Skeleton className="h-48" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={dialogOpen}
          onOpenChange={(v) => {
            setDialogOpen(v);
            if (!v) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              新建视图
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>{editingView ? "编辑视图" : "新建视图"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 overflow-y-auto">
              <div>
                <label className="text-sm font-medium block mb-1">视图名称</label>
                <Input
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder="例如: 活跃用户视图"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">
                  SQL 查询 <span className="text-xs text-muted-foreground">(仅 SELECT)</span>
                </label>
                <Textarea
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  placeholder="SELECT * FROM &quot;mzan_tbl_xxx&quot; WHERE ..."
                  className="font-mono text-sm min-h-[200px]"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">描述 (可选)</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="视图用途说明"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <DialogClose asChild>
                <Button variant="outline" size="sm">取消</Button>
              </DialogClose>
              <Button size="sm" onClick={handleSave} disabled={!viewName || !sql}>
                {editingView ? "保存" : "创建"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* SQL Preview Dialog */}
      <Dialog
        open={!!previewSql}
        onOpenChange={(v) => {
          if (!v) {
            setPreviewSql(null);
            setPreviewResult(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>SQL 预览</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto">
            <div className="bg-muted rounded-md p-3 font-mono text-sm whitespace-pre-wrap max-h-[200px] overflow-y-auto">
              {previewSql}
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={previewQuery} disabled={previewing}>
                {previewing ? "查询中..." : "运行查询"}
              </Button>
            </div>
            {previewResult && previewResult.length > 0 && (
              <div className="overflow-x-auto border rounded-md max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {Object.keys(previewResult[0]).map((k) => (
                        <th key={k} className="text-left p-2 font-medium whitespace-nowrap">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="p-2 truncate max-w-[150px]">
                            {String(v ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {previewResult && previewResult.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">没有结果</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {(!views || views.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">还没有视图</p>
            <p className="text-xs text-muted-foreground mt-1">
              视图是基于 SQL 查询的虚拟表，可简化复杂查询
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {views.map((view) => (
            <Card key={view.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {view.viewName}
                      {view.status === "CREATED" ? (
                        <Badge variant="success" className="text-[10px]">已创建</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">草稿</Badge>
                      )}
                    </CardTitle>
                    {view.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {view.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => {
                        setPreviewSql(view.sql);
                        setPreviewResult(null);
                      }}
                      title="预览 SQL"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => openEdit(view)}
                      title="编辑"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={executing === view.id}
                      onClick={() => executeView(view)}
                    >
                      <Play className="h-3.5 w-3.5 mr-1" />
                      {executing === view.id ? "执行中..." : "执行"}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除</AlertDialogTitle>
                          <AlertDialogDescription>
                            确定要删除视图 &ldquo;{view.viewName}&rdquo; 吗？如果已创建，对应的 SQLite 视图也会被删除。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(view.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-xs font-mono bg-muted rounded p-2 overflow-x-auto max-h-20">
                  {view.sql}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
