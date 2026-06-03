"use client";

import { useEffect, useRef, useState } from "react";
import { useBatchImportStore, type BackgroundTask } from "@/stores/batch-import-store";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@mizan/shared-lib/utils";
import { toast } from "sonner";

export function BatchImportProgress() {
  const tasks = useBatchImportStore((s) => s.tasks);
  const activeTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "failed");
  const completedTasks = tasks.filter((t) => t.status === "completed" || t.status === "failed");
  const [expanded, setExpanded] = useState(false);
  const notifiedRef = useRef<Set<string>>(new Set());

  // Show toast notification when a task completes or fails
  useEffect(() => {
    for (const task of tasks) {
      if (notifiedRef.current.has(task.id)) continue;
      if (task.status === "completed") {
        notifiedRef.current.add(task.id);
        toast.success(`导入完成`, {
          description: `${task.fileName} — 新增 ${task.inserted} 行，更新 ${task.updated} 行${task.skipped ? `，跳过 ${task.skipped} 行` : ""}`,
          duration: 5000,
        });
      } else if (task.status === "failed") {
        notifiedRef.current.add(task.id);
        const errMsg = task.errors[0]?.message || "未知错误";
        toast.error(`导入失败`, {
          description: `${task.fileName} — ${errMsg}`,
          duration: 8000,
        });
      }
    }
  }, [tasks]);

  if (tasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {/* Active tasks */}
      {activeTasks.map((task) => (
        <ActiveTaskCard key={task.id} task={task} />
      ))}

      {/* Completed tasks summary */}
      {completedTasks.length > 0 && (
        <div className="bg-card border rounded-lg shadow-lg p-3 text-sm">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-between w-full"
          >
            <span className="font-medium">
              <CheckCircle2 className="h-4 w-4 inline text-green-500 mr-1" />
              已完成 {completedTasks.length} 个导入
            </span>
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          {expanded && (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {completedTasks.map((t) => (
                <CompletedTaskRow key={t.id} task={t} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActiveTaskCard({ task }: { task: BackgroundTask }) {
  const removeTask = useBatchImportStore((s) => s.removeTask);
  const progress = task.totalRows > 0 ? Math.round((task.processedRows / task.totalRows) * 100) : 0;

  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          <span className="font-medium truncate">{task.fileName}</span>
        </div>
        <button
          onClick={() => removeTask(task.id)}
          className="text-muted-foreground hover:text-foreground shrink-0 ml-2"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="w-full bg-muted rounded-full h-2 mb-1">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          处理中 {task.processedRows}/{task.totalRows} 行
        </span>
        <span>{progress}%</span>
      </div>
      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
        <span className="text-green-600">新增 {task.inserted}</span>
        <span className="text-blue-600">更新 {task.updated}</span>
        {task.skipped > 0 && <span className="text-amber-600">跳过 {task.skipped}</span>}
      </div>
    </div>
  );
}

function CompletedTaskRow({ task }: { task: BackgroundTask }) {
  const removeTask = useBatchImportStore((s) => s.removeTask);

  return (
    <div className="flex items-center justify-between text-xs py-1 border-b last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        {task.status === "completed" ? (
          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
        ) : (
          <XCircle className="h-3 w-3 text-red-500 shrink-0" />
        )}
        <span className="truncate">{task.fileName}</span>
        <span className="text-muted-foreground shrink-0">
          +{task.inserted}/~{task.updated}
        </span>
      </div>
      <button
        onClick={() => removeTask(task.id)}
        className="text-muted-foreground hover:text-foreground shrink-0 ml-2"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
