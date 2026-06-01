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
import { Plus, Play, Trash2, Pencil, Terminal } from "lucide-react";

interface Script {
  id: string;
  scriptName: string;
  sql: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ExecResult {
  success: boolean;
  message: string;
  affectedRows: number;
  resultCount: number;
  results: Record<string, unknown>[] | null;
}

export function ScriptEditor({ schemaId }: { schemaId: string }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [scriptName, setScriptName] = useState("");
  const [sql, setSql] = useState("");
  const [description, setDescription] = useState("");
  const [executing, setExecuting] = useState<string | null>(null);
  const [execResult, setExecResult] = useState<ExecResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);

  const { data: scripts, isLoading } = useQuery<Script[]>({
    queryKey: ["scripts", schemaId],
    queryFn: () => fetch(`/api/schemas/${schemaId}/scripts`).then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: { scriptName: string; sql: string; description?: string }) =>
      fetch(`/api/schemas/${schemaId}/scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("脚本已创建");
        setDialogOpen(false);
        resetForm();
        queryClient.invalidateQueries({ queryKey: ["scripts", schemaId] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (scriptId: string) =>
      fetch(`/api/schemas/${schemaId}/scripts/${scriptId}`, {
        method: "DELETE",
      }).then((r) => r.json()),
    onSuccess: () => {
      toast.success("脚本已删除");
      queryClient.invalidateQueries({ queryKey: ["scripts", schemaId] });
    },
  });

  const executeScript = async (script: Script) => {
    setExecuting(script.id);
    try {
      const res = await fetch(
        `/api/schemas/${schemaId}/scripts/${script.id}/execute`,
        { method: "POST" }
      );
      const data: ExecResult = await res.json();
      if (!res.ok) {
        toast.error((data as unknown as { error: string }).error || "执行失败");
      } else {
        setExecResult(data);
        setResultOpen(true);
        toast.success("脚本执行完成");
      }
    } catch {
      toast.error("执行失败");
    } finally {
      setExecuting(null);
    }
  };

  const resetForm = () => {
    setScriptName("");
    setSql("");
    setDescription("");
    setEditingScript(null);
  };

  const openEdit = (script: Script) => {
    setEditingScript(script);
    setScriptName(script.scriptName);
    setSql(script.sql);
    setDescription(script.description || "");
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editingScript) {
      fetch(`/api/schemas/${schemaId}/scripts/${editingScript.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptName, sql, description }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            toast.error(data.error);
          } else {
            toast.success("脚本已更新");
            setDialogOpen(false);
            resetForm();
            queryClient.invalidateQueries({ queryKey: ["scripts", schemaId] });
          }
        });
    } else {
      createMutation.mutate({ scriptName, sql, description });
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
              新建脚本
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>{editingScript ? "编辑脚本" : "新建脚本"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 overflow-y-auto">
              <div>
                <label className="text-sm font-medium block mb-1">脚本名称</label>
                <Input
                  value={scriptName}
                  onChange={(e) => setScriptName(e.target.value)}
                  placeholder="例如: 清空临时数据"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">
                  SQL 语句 <span className="text-xs text-muted-foreground">(支持 INSERT/UPDATE/DELETE/SELECT)</span>
                </label>
                <Textarea
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  placeholder="DELETE FROM &quot;mzan_tbl_xxx&quot; WHERE ..."
                  className="font-mono text-sm min-h-[200px]"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">描述 (可选)</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="脚本用途说明"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <DialogClose asChild>
                <Button variant="outline" size="sm">取消</Button>
              </DialogClose>
              <Button size="sm" onClick={handleSave} disabled={!scriptName || !sql}>
                {editingScript ? "保存" : "创建"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Execution Result Dialog */}
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>执行结果</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto">
            {execResult && (
              <>
                <div className="flex gap-4 text-sm">
                  <span>
                    影响行数: <strong>{execResult.affectedRows}</strong>
                  </span>
                  <span>
                    返回行数: <strong>{execResult.resultCount}</strong>
                  </span>
                </div>
                {execResult.results && execResult.results.length > 0 && (
                  <div className="overflow-x-auto border rounded-md max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          {Object.keys(execResult.results[0]).map((k) => (
                            <th key={k} className="text-left p-2 font-medium whitespace-nowrap">
                              {k}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {execResult.results.map((row, i) => (
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
                {execResult.results && execResult.results.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    查询执行完成，没有返回数据
                  </p>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {(!scripts || scripts.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Terminal className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">还没有脚本</p>
            <p className="text-xs text-muted-foreground mt-1">
              脚本是保存的 SQL 语句，可用于批量操作和数据清理
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {scripts.map((script) => (
            <Card key={script.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {script.scriptName}
                    </CardTitle>
                    {script.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {script.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => openEdit(script)}
                      title="编辑"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={executing === script.id}
                      onClick={() => executeScript(script)}
                    >
                      <Play className="h-3.5 w-3.5 mr-1" />
                      {executing === script.id ? "执行中..." : "运行"}
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
                            确定要删除脚本 &ldquo;{script.scriptName}&rdquo; 吗？
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(script.id)}
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
                  {script.sql}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
