"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Play, TestTube, RefreshCw } from "lucide-react";

interface SyncConnection {
  id: string;
  name: string;
  endpoint: string;
  method: string;
  headers: string | null;
  authType: string;
  authConfig: string | null;
  direction: string;
  tableId: string;
  keyField: string | null;
  fieldMapping: string | null;
  enabled: boolean;
  lastSyncAt: string | null;
  table?: { logicalName: string; physicalName: string };
}

export default function SyncPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SyncConnection | null>(null);
  const [form, setForm] = useState({
    name: "", endpoint: "", method: "GET", authType: "none",
    authUsername: "", authPassword: "", authToken: "",
    direction: "pull", tableId: "", keyField: "",
  });

  const { data: connections, isLoading } = useQuery<SyncConnection[]>({
    queryKey: ["sync-connections"],
    queryFn: async () => { const r = await fetch("/api/sync/connections"); if (!r.ok) throw Error(); return r.json(); },
  });

  const { data: tables } = useQuery({
    queryKey: ["admin-tables"],
    queryFn: async () => {
      const r = await fetch("/api/schemas");
      const schemas = await r.json();
      const all: Array<{ id: string; name: string }> = [];
      for (const s of schemas) {
        const sr = await fetch(`/api/schemas/${s.id}`);
        const sd = await sr.json();
        (sd.tables || []).forEach((t: { id: string; logicalName: string; status: string }) => {
          if (t.status !== "DRAFT") all.push({ id: t.id, name: `${s.name} / ${t.logicalName}` });
        });
      }
      return all;
    },
  });

  const resetForm = () => setForm({ name: "", endpoint: "", method: "GET", authType: "none", authUsername: "", authPassword: "", authToken: "", direction: "pull", tableId: "", keyField: "" });

  const openNew = () => { resetForm(); setEditing(null); setDialogOpen(true); };
  const openEdit = (c: SyncConnection) => {
    const ac = c.authConfig ? JSON.parse(c.authConfig) : {};
    setForm({
      name: c.name, endpoint: c.endpoint, method: c.method,
      authType: c.authType, authUsername: ac.username || "", authPassword: ac.password || "", authToken: ac.token || "",
      direction: c.direction, tableId: c.tableId, keyField: c.keyField || "",
    });
    setEditing(c);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name: form.name, endpoint: form.endpoint, method: form.method,
        authType: form.authType, direction: form.direction,
        tableId: form.tableId, keyField: form.keyField,
      };
      if (form.authType === "basic") body.authConfig = { username: form.authUsername, password: form.authPassword };
      if (form.authType === "token") body.authConfig = { token: form.authToken };
      const url = editing ? `/api/sync/connections/${editing.id}` : "/api/sync/connections";
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || "保存失败"); }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sync-connections"] }); setDialogOpen(false); toast.success(editing ? "已更新" : "已创建"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "保存失败"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`/api/sync/connections/${id}`, { method: "DELETE" }); if (!r.ok) throw Error(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sync-connections"] }); toast.success("已删除"); },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/sync/connections/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test" }) });
      return r.json();
    },
    onSuccess: (d) => { if (d.success) toast.success("连接成功"); else toast.error(`连接失败: ${d.error || d.statusText}`); },
    onError: () => toast.error("测试失败"),
  });

  const triggerMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/sync/connections/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "trigger" }) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
      return r.json();
    },
    onSuccess: (d) => { toast.success(`同步完成，处理 ${d.totalRows} 行`); queryClient.invalidateQueries({ queryKey: ["sync-connections"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "同步失败"),
  });

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />新建同步</Button>
      </div>

      {(!connections || connections.length === 0) ? (
        <Card><CardContent className="py-12 text-center">
          <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">暂无同步配置</p>
        </CardContent></Card>
      ) : connections.map((c) => (
        <Card key={c.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">{c.name}</CardTitle>
                <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-lg">{c.endpoint}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Badge variant={c.direction === "bidirectional" ? "default" : c.direction === "pull" ? "secondary" : "warning"}>
                  {c.direction === "pull" ? "拉取" : c.direction === "push" ? "推送" : "双向"}
                </Badge>
                <Badge variant={c.enabled ? "success" : "secondary"}>{c.enabled ? "启用" : "停用"}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>目标表: {c.table?.logicalName || c.tableId}</p>
              {c.lastSyncAt && <p>上次同步: {new Date(c.lastSyncAt).toLocaleString("zh-CN")}</p>}
            </div>
            <div className="flex gap-1 mt-2">
              <Button variant="ghost" size="sm" className="h-7" onClick={() => testMutation.mutate(c.id)} disabled={testMutation.isPending}>
                <TestTube className="h-3 w-3 mr-1" />测试
              </Button>
              <Button variant="ghost" size="sm" className="h-7" onClick={() => triggerMutation.mutate(c.id)} disabled={triggerMutation.isPending}>
                <Play className="h-3 w-3 mr-1" />同步
              </Button>
              <Button variant="ghost" size="sm" className="h-7" onClick={() => openEdit(c)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => { if (confirm("确定删除？")) deleteMutation.mutate(c.id); }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "编辑同步" : "新建同步连接"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium">名称</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如: ERP 商品接口" />
            </div>
            <div>
              <label className="text-sm font-medium">API 地址</label>
              <Input value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} placeholder="https://api.example.com/products" className="font-mono text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">请求方法</label>
                <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">同步方向</label>
                <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pull">拉取 (外部 → 本地)</SelectItem>
                    <SelectItem value="push">推送 (本地 → 外部)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">目标数据表</label>
              <Select value={form.tableId} onValueChange={(v) => setForm({ ...form, tableId: v })}>
                <SelectTrigger><SelectValue placeholder="选择表" /></SelectTrigger>
                <SelectContent>
                  {(tables || []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">关键字段（用于增量更新）</label>
              <Input value={form.keyField} onChange={(e) => setForm({ ...form, keyField: e.target.value })} placeholder="例如: product_code" className="font-mono text-sm" />
              <p className="text-[10px] text-muted-foreground mt-0.5">留空则全部新增，填字段名则匹配更新</p>
            </div>
            <div>
              <label className="text-sm font-medium">认证方式</label>
              <Select value={form.authType} onValueChange={(v) => setForm({ ...form, authType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无认证</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                  <SelectItem value="token">Bearer Token</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.authType === "basic" && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium">用户名</label><Input value={form.authUsername} onChange={(e) => setForm({ ...form, authUsername: e.target.value })} /></div>
                <div><label className="text-sm font-medium">密码</label><Input type="password" value={form.authPassword} onChange={(e) => setForm({ ...form, authPassword: e.target.value })} /></div>
              </div>
            )}
            {form.authType === "token" && (
              <div><label className="text-sm font-medium">Token</label><Input type="password" value={form.authToken} onChange={(e) => setForm({ ...form, authToken: e.target.value })} /></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || !form.endpoint || !form.tableId || saveMutation.isPending}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
