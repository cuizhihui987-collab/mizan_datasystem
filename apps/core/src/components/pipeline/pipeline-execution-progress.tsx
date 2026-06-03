"use client";

import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

interface StepResult {
  stepId: string;
  stepLabel: string;
  status: string;
  affectedRows?: number;
  errorMessage?: string;
  outputTable?: string;
}

interface ExecutionProgressProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: StepResult[] | null;
  running: boolean;
}

const statusIcon = (status: string) => {
  switch (status) {
    case "COMPLETED":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "FAILED":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "RUNNING":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

const statusBadge = (status: string) => {
  switch (status) {
    case "COMPLETED":
      return <Badge variant="success" className="text-[10px]">成功</Badge>;
    case "FAILED":
      return <Badge variant="destructive" className="text-[10px]">失败</Badge>;
    case "RUNNING":
      return <Badge variant="warning" className="text-[10px]">执行中</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px]">等待</Badge>;
  }
};

export function PipelineExecutionProgress({
  open,
  onOpenChange,
  results,
  running,
}: ExecutionProgressProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [results]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {running ? "正在执行..." : results ? "执行完成" : "执行中..."}
          </DialogTitle>
        </DialogHeader>

        <div ref={scrollRef} className="max-h-[400px] overflow-y-auto space-y-2 py-2">
          {!results || results.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
              <p>启动执行中...</p>
            </div>
          ) : (
            results.map((r, i) => (
              <div
                key={r.stepId}
                className={`p-3 rounded-lg border ${
                  r.status === "FAILED"
                    ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                    : r.status === "COMPLETED"
                    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {statusIcon(r.status)}
                    <span className="text-sm font-medium">
                      #{i + 1} {r.stepLabel}
                    </span>
                    {statusBadge(r.status)}
                  </div>
                </div>
                {r.affectedRows !== undefined && r.status === "COMPLETED" && (
                  <p className="text-xs text-muted-foreground mt-1 ml-6">
                    影响行数: {r.affectedRows.toLocaleString()}
                  </p>
                )}
                {r.errorMessage && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 ml-6">
                    {r.errorMessage}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
