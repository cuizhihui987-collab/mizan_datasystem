"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Pencil, Trash2, FileSpreadsheet, Database, Globe, Code, Merge, Filter, Table, Play } from "lucide-react";

interface StepCardStep {
  stepOrder: number;
  stepType: string;
  label: string;
  config: Record<string, unknown>;
  sourceTableId?: string;
}

interface StepCardProps {
  step: StepCardStep;
  index: number;
  status?: string;
  onEdit: () => void;
  onDelete: () => void;
}

const stepTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  source_import: { label: "数据导入", icon: <FileSpreadsheet className="h-4 w-4" />, color: "text-blue-500" },
  source_table: { label: "数据表源", icon: <Database className="h-4 w-4" />, color: "text-green-500" },
  source_api: { label: "API 源", icon: <Globe className="h-4 w-4" />, color: "text-purple-500" },
  transform_sql: { label: "SQL 转换", icon: <Code className="h-4 w-4" />, color: "text-orange-500" },
  transform_merge: { label: "合并", icon: <Merge className="h-4 w-4" />, color: "text-cyan-500" },
  transform_filter: { label: "筛选", icon: <Filter className="h-4 w-4" />, color: "text-yellow-500" },
  output_table: { label: "输出表", icon: <Table className="h-4 w-4" />, color: "text-red-500" },
};

const statusBadge: Record<string, { label: string; variant: "secondary" | "default" | "success" | "warning" | "destructive" }> = {
  PENDING: { label: "待执行", variant: "secondary" },
  RUNNING: { label: "执行中", variant: "warning" },
  COMPLETED: { label: "已完成", variant: "success" },
  FAILED: { label: "失败", variant: "destructive" },
};

export function PipelineStepCard({ step, index, status, onEdit, onDelete }: StepCardProps) {
  const config = stepTypeConfig[step.stepType] || { label: "未知", icon: <Play className="h-4 w-4" />, color: "text-gray-500" };
  const st = status ? statusBadge[status] : null;

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-accent/30 transition-colors group">
      <GripVertical className="h-5 w-5 text-muted-foreground/30 cursor-grab shrink-0" />

      <div className={`${config.color} shrink-0`}>
        {config.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
          <span className="text-sm font-medium truncate">{step.label || config.label}</span>
          {st && (
            <Badge variant={st.variant} className="text-[10px] px-1.5 py-0">
              {st.label}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground/60 mt-0.5">
          {step.stepType === "source_table" && `源: ${String(step.config?.sourceTableId || "")}`}
          {step.stepType === "transform_filter" && `条件: ${(step.config?.filters as { conditions?: unknown[] })?.conditions?.length || 0} 个`}
          {step.stepType === "output_table" && `输出: ${String(step.config?.tableName || "")}`}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
