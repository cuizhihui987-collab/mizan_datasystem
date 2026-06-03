"use client";

import { Position } from "@xyflow/react";
import { cn } from "@mizan/shared-lib/utils";
import { HandleRenderer } from "./handle-renderer";
import { NodeStatusIndicator } from "./node-status-indicator";
import { STEP_GROUP_COLORS, getInputPortCount, getOutputPortCount } from "@/lib/pipeline/pipeline-converter";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import type { PipelineNodeData } from "@/lib/pipeline/pipeline-converter";
import type { StepGroup } from "@/lib/pipeline/dag-utils";
import {
  Database,
  FileSpreadsheet,
  Globe,
  Code,
  GitMerge,
  Filter,
  Table,
  GitBranch,
  Shuffle,
  Repeat,
  Combine,
  ExternalLink,
  Download,
  Bell,
  Server,
  Radio,
  Webhook,
  Layers,
  ArrowUpDown,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  source_table: Database,
  source_import: FileSpreadsheet,
  source_api: Globe,
  source_database: Server,
  source_stream: Radio,
  source_webhook: Webhook,
  transform_sql: Code,
  transform_merge: GitMerge,
  transform_filter: Filter,
  transform_aggregate: Layers,
  transform_pivot: ArrowUpDown,
  transform_deduplicate: ScrollText,
  transform_sort: ArrowUpDown,
  transform_union: Combine,
  transform_custom_script: Code,
  output_table: Table,
  output_api: ExternalLink,
  output_file: Download,
  output_notification: Bell,
  flow_branch: GitBranch,
  flow_switch: GitBranch,
  flow_parallel: Shuffle,
  flow_loop: Repeat,
  flow_merge_all: Combine,
};

interface Props {
  data: PipelineNodeData;
  selected: boolean;
  children?: React.ReactNode;
}

export function PipelineNodeWrapper({
  data,
  selected,
  children,
}: Props) {
  const colors = STEP_GROUP_COLORS[data.group] || STEP_GROUP_COLORS.transform;
  const Icon = ICON_MAP[data.stepType] || Code;
  const inputCount = getInputPortCount(data.stepType);
  const outputCount = getOutputPortCount(data.stepType);

  const inputHandles = Array.from({ length: inputCount }, (_, i) => ({
    id: inputCount > 1 ? `input-${i + 1}` : "input",
    label: inputCount > 1 ? `入${i + 1}` : undefined,
    type: "target" as const,
    position: Position.Left,
  }));

  const outputHandles = Array.from({ length: outputCount }, (_no, i) => ({
    id: outputCount > 1 ? `output-${i + 1}` : "output",
    label: outputCount > 1 ? `出${i + 1}` : undefined,
    type: "source" as const,
    position: Position.Right,
  }));

  const handleEdit = data.onEdit || (() => {});
  const handleDelete = data.onDelete || (() => {});

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            "bg-white rounded-xl shadow-md border-2 transition-shadow min-w-[200px] max-w-[260px]",
            selected ? "shadow-lg ring-2 ring-blue-400" : "hover:shadow-lg",
            data.status === "RUNNING" && "animate-pulse-border border-blue-400",
            data.status === "COMPLETED" && "border-green-500",
            data.status === "FAILED" && "border-red-500",
            !data.status || data.status === "PENDING" ? `border-gray-200` : ""
          )}
        >
          {/* Input handles */}
          <HandleRenderer handles={inputHandles} group={data.group} />

          {/* Header */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-t-xl text-white text-sm font-medium"
            style={{ backgroundColor: colors.bg }}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            <span className="truncate">{data.label}</span>
          </div>

          {/* Body */}
          <div className="px-3 py-2.5 text-xs text-gray-600 min-h-[40px]">
            {children || <p className="text-gray-400 italic">{data.summary}</p>}
          </div>

          {/* Status */}
          {data.status && data.status !== "PENDING" && (
            <NodeStatusIndicator status={data.status} className="rounded-none rounded-b-xl" />
          )}

          {/* Output handles */}
          <HandleRenderer handles={outputHandles} group={data.group} />
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="min-w-[160px]">
        <ContextMenuItem onClick={handleEdit}>配置步骤</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
          删除节点
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
