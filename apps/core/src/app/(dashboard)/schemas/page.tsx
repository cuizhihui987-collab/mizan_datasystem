"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Database, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface Schema {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  _count: { tables: number };
  user?: { name: string | null; email: string | null };
}

export default function SchemasPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: schemas = [], isLoading } = useQuery<Schema[]>({
    queryKey: ["schemas"],
    queryFn: () => fetch("/api/schemas").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      fetch("/api/schemas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schemas"] });
      setOpen(false);
      setName("");
      setDescription("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/schemas/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schemas"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">数据模型</h1>
          <p className="text-muted-foreground mt-1">管理您的数据模型和表结构</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新建模型
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建数据模型</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({ name, description });
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium">模型名称</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如: 商品数据"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">描述（可选）</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="模型的用途说明"
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "创建中..." : "创建"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-5 bg-muted rounded w-2/3 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : schemas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">还没有数据模型</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              创建第一个数据模型
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {schemas.map((schema) => (
            <Card key={schema.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{schema.name}</CardTitle>
                  {schema.description && (
                    <p className="text-sm text-muted-foreground mt-1">{schema.description}</p>
                  )}
                </div>
                <Badge variant={schema.status === "ACTIVE" ? "success" : "secondary"}>
                  {schema.status === "ACTIVE" ? "使用中" : "已归档"}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {schema._count.tables} 个数据表
                    </span>
                    <div className="flex gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/schemas/${schema.id}`}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        查看
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(schema.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                    <span>{schema.user?.name || schema.user?.email || "未知用户"}</span>
                    <span className="text-muted-foreground/50">|</span>
                    <span>{new Date(schema.createdAt).toLocaleDateString("zh-CN")}</span>
                  </div>
                </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
