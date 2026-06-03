"use client";

import { useState } from "react";
import { cn } from "@mizan/shared-lib/utils";
import { Input } from "@/components/ui/input";
import { getDefaultLabel, STEP_GROUP_COLORS } from "@/lib/pipeline/pipeline-converter";
import type { StepGroup } from "@/lib/pipeline/dag-utils";
import {
  Database, FileSpreadsheet, Globe, Code, GitMerge, Filter, Table,
  GitBranch, Shuffle, Repeat, Combine, Server, Radio, Webhook,
  Layers, ArrowUpDown, ScrollText, ExternalLink, Download, Bell,
  type LucideIcon,
} from "lucide-react";

interface PaletteItem {
  type: string;
  group: StepGroup;
  icon: LucideIcon;
}

const PALETTE_ITEMS: PaletteItem[] = [
  // Source
  { type: "source_table", group: "source", icon: Database },
  { type: "source_import", group: "source", icon: FileSpreadsheet },
  { type: "source_api", group: "source", icon: Globe },
  { type: "source_database", group: "source", icon: Server },
  { type: "source_stream", group: "source", icon: Radio },
  { type: "source_webhook", group: "source", icon: Webhook },
  // Transform
  { type: "transform_sql", group: "transform", icon: Code },
  { type: "transform_filter", group: "transform", icon: Filter },
  { type: "transform_merge", group: "transform", icon: GitMerge },
  { type: "transform_aggregate", group: "transform", icon: Layers },
  { type: "transform_deduplicate", group: "transform", icon: ScrollText },
  { type: "transform_sort", group: "transform", icon: ArrowUpDown },
  { type: "transform_union", group: "transform", icon: Combine },
  // Flow
  { type: "flow_branch", group: "flow", icon: GitBranch },
  { type: "flow_switch", group: "flow", icon: GitBranch },
  { type: "flow_parallel", group: "flow", icon: Shuffle },
  { type: "flow_loop", group: "flow", icon: Repeat },
  { type: "flow_merge_all", group: "flow", icon: Combine },
  // Output
  { type: "output_table", group: "output", icon: Table },
  { type: "output_api", group: "output", icon: ExternalLink },
  { type: "output_file", group: "output", icon: Download },
  { type: "output_notification", group: "output", icon: Bell },
];

const GROUP_LABELS: Record<StepGroup, string> = {
  source: "数据源",
  transform: "数据处理",
  output: "输出",
  flow: "流程控制",
};

interface Props {
  onDragStart: (type: string, event: React.DragEvent) => void;
}

export function NodePalette({ onDragStart }: Props) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? PALETTE_ITEMS.filter((item) => {
        const label = getDefaultLabel(item.type);
        return label.includes(search) || item.type.includes(search);
      })
    : PALETTE_ITEMS;

  const grouped = filtered.reduce<Record<string, PaletteItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <div className="w-56 border-l bg-white flex flex-col">
      <div className="p-2 border-b">
        <Input
          placeholder="搜索组件..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group}>
            <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">
              {GROUP_LABELS[group as StepGroup]}
            </h4>
            <div className="space-y-0.5">
              {items.map((item) => {
                const colors = STEP_GROUP_COLORS[item.group];
                const Icon = item.icon;
                return (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={(e) => onDragStart(item.type, e)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing hover:bg-accent text-xs transition-colors"
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: colors.bg }}
                    >
                      <Icon className="h-3 w-3" />
                    </div>
                    <span className="truncate">{getDefaultLabel(item.type)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">无匹配组件</p>
        )}
      </div>
    </div>
  );
}
