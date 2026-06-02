"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, GitBranch, Play, Loader2 } from "lucide-react";

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  _count: { steps: number };
}

const statusLabel: Record<string, { label: string; variant: "secondary" | "default" | "success" | "warning" | "destructive" }> = {
  DRAFT: { label: "草稿", variant: "secondary" },
  ACTIVE: { label: "启用", variant: "success" },
  RUNNING: { label: "执行中", variant: "warning" },
  COMPLETED: { label: "已完成", variant: "success" },
  FAILED: { label: "失败", variant: "destructive" },
  ARCHIVED: { label: "已归档", variant: "secondary" },
};

export function PipelineList({ schemaId }: { schemaId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const { data: pipelines, isLoading } = useQuery<Pipeline[]>({
    queryKey: ["pipelines", schemaId],
    queryFn: async () => {
      const res = await fetch(`/api/schemas/${schemaId}/pipelines`);
      if (!res.ok) throw new Error("加载失败");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/schemas/${schemaId}/pipelines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "创建失败");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pipelines", schemaId] });
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      toast.success("Pipeline 创建成功");
      router.push(`/schemas/${schemaId}/pipelines/${data.id}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "创建失败");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
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
          新建 Pipeline
        </Button>
      </div>

      {(!pipelines || pipelines.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>暂无 Pipeline</p>
            <p className="text-sm mt-1">创建数据处理流水线来自动化你的数据流程</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {pipelines.map((p) => {
            const st = statusLabel[p.status] || statusLabel.DRAFT;
            return (
              <Card
                key={p.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => router.push(`/schemas/${schemaId}/pipelines/${p.id}`)}
              >
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <GitBranch className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                      {p.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{p.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        {p._count.steps} 个步骤 · 创建于 {new Date(p.createdAt).toLocaleDateString("zh-CN")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.status === "COMPLETED" && (
                      <Button variant="outline" size="sm" onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/schemas/${schemaId}/pipelines/${p.id}`);
                      }}>
                        <Play className="h-3.5 w-3.5 mr-1" />
                        运行
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建 Pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">名称</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例如：商品数据处理"
              />
            </div>
            <div>
              <label className="text-sm font-medium">描述（可选）</label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="描述这个 Pipeline 的用途"
              />
            </div>
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
