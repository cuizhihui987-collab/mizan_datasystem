"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileSpreadsheet, Database, Globe, Code, GitMerge, Filter, Table,
  GitBranch, Shuffle, Repeat, Combine, Server, Radio, Webhook,
  Layers, ArrowUpDown, ScrollText, ExternalLink, Download, Bell,
} from "lucide-react";

const STEP_TYPES = [
  // ── 数据源 ──
  { type: "source_table", label: "数据表源", icon: Database, desc: "使用已有数据表作为输入", color: "text-green-500", group: "数据源" },
  { type: "source_import", label: "导入文件", icon: FileSpreadsheet, desc: "从 Excel/CSV 文件导入数据", color: "text-blue-500", group: "数据源" },
  { type: "source_api", label: "API 源", icon: Globe, desc: "从外部 API 拉取数据", color: "text-purple-500", group: "数据源" },
  { type: "source_database", label: "外部数据库", icon: Server, desc: "连接外部 MySQL/PostgreSQL 数据库", color: "text-indigo-500", group: "数据源" },
  { type: "source_stream", label: "流式数据", icon: Radio, desc: "从 Kafka/Redis 流式读取数据", color: "text-pink-500", group: "数据源" },
  { type: "source_webhook", label: "Webhook", icon: Webhook, desc: "接收外部系统推送的数据", color: "text-violet-500", group: "数据源" },

  // ── 数据处理 ──
  { type: "transform_sql", label: "SQL 转换", icon: Code, desc: "使用 SQL 对数据进行转换", color: "text-orange-500", group: "数据处理" },
  { type: "transform_merge", label: "合并", icon: GitMerge, desc: "将两个数据源合并（JOIN）", color: "text-cyan-500", group: "数据处理" },
  { type: "transform_filter", label: "筛选", icon: Filter, desc: "按条件筛选和清理数据", color: "text-yellow-500", group: "数据处理" },
  { type: "transform_aggregate", label: "聚合", icon: Layers, desc: "分组聚合计算（GROUP BY）", color: "text-amber-500", group: "数据处理" },
  { type: "transform_deduplicate", label: "去重", icon: ScrollText, desc: "根据指定列去除重复行", color: "text-lime-500", group: "数据处理" },
  { type: "transform_sort", label: "排序", icon: ArrowUpDown, desc: "按指定列排序数据", color: "text-teal-500", group: "数据处理" },
  { type: "transform_pivot", label: "行列转置", icon: ArrowUpDown, desc: "PIVOT / UNPIVOT 行列互换", color: "text-emerald-500", group: "数据处理" },
  { type: "transform_custom_script", label: "自定义脚本", icon: Code, desc: "通过脚本实现自定义转换", color: "text-stone-500", group: "数据处理" },

  // ── 流程控制 ──
  { type: "flow_branch", label: "条件分支", icon: GitBranch, desc: "根据条件将数据分发到不同路径", color: "text-purple-500", group: "流程控制" },
  { type: "flow_switch", label: "多路分支", icon: GitBranch, desc: "多条件匹配分发数据", color: "text-fuchsia-500", group: "流程控制" },
  { type: "flow_parallel", label: "并行分发", icon: Shuffle, desc: "数据同时下发多条路径并行处理", color: "text-violet-500", group: "流程控制" },
  { type: "flow_loop", label: "循环", icon: Repeat, desc: "对数据迭代执行相同逻辑", color: "text-indigo-500", group: "流程控制" },
  { type: "flow_merge_all", label: "合并流", icon: Combine, desc: "UNION ALL 合并多条输入", color: "text-blue-500", group: "流程控制" },

  // ── 输出 ──
  { type: "output_table", label: "输出到表", icon: Table, desc: "将结果保存到数据表", color: "text-red-500", group: "输出" },
  { type: "output_api", label: "推送到 API", icon: ExternalLink, desc: "将结果发送到外部 API", color: "text-rose-500", group: "输出" },
  { type: "output_file", label: "导出文件", icon: Download, desc: "导出为 Excel/CSV 文件", color: "text-amber-500", group: "输出" },
  { type: "output_notification", label: "通知", icon: Bell, desc: "发送邮件或 Webhook 通知", color: "text-sky-500", group: "输出" },
];

interface AddStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (stepType: string, label: string) => void;
}

export function AddStepDialog({ open, onOpenChange, onConfirm }: AddStepDialogProps) {
  const [selectedType, setSelectedType] = useState<string>("source_table");
  const [label, setLabel] = useState("");

  const handleConfirm = () => {
    onConfirm(selectedType, label);
    setLabel("");
    setSelectedType("source_table");
  };

  const groups = STEP_TYPES.reduce<Record<string, typeof STEP_TYPES>>((acc, s) => {
    (acc[s.group] = acc[s.group] || []).push(s);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加步骤</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium">步骤名称（可选）</label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例如：导入商品数据"
              className="mt-1"
            />
          </div>

          {Object.entries(groups).map(([group, steps]) => (
            <div key={group}>
              <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">
                {group}
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {steps.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.type}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${
                        selectedType === s.type
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent border-transparent"
                      }`}
                      onClick={() => setSelectedType(s.type)}
                    >
                      <Icon className={`h-5 w-5 ${s.color}`} />
                      <div>
                        <p className="text-sm font-medium">{s.label}</p>
                        <p className="text-xs text-muted-foreground">{s.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm}>添加</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
