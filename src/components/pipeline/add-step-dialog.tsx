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
import { FileSpreadsheet, Database, Globe, Code, Merge, Filter, Table } from "lucide-react";

const STEP_TYPES = [
  { type: "source_import", label: "数据导入", icon: FileSpreadsheet, desc: "从 Excel/CSV 文件导入数据", color: "text-blue-500", group: "数据源" },
  { type: "source_table", label: "数据表源", icon: Database, desc: "使用已有数据表作为输入", color: "text-green-500", group: "数据源" },
  { type: "source_api", label: "API 源", icon: Globe, desc: "从外部 API 拉取数据", color: "text-purple-500", group: "数据源" },
  { type: "transform_sql", label: "SQL 转换", icon: Code, desc: "使用 SQL 对数据进行转换", color: "text-orange-500", group: "数据处理" },
  { type: "transform_merge", label: "合并", icon: Merge, desc: "将两个数据源合并（JOIN）", color: "text-cyan-500", group: "数据处理" },
  { type: "transform_filter", label: "筛选", icon: Filter, desc: "按条件筛选和清理数据", color: "text-yellow-500", group: "数据处理" },
  { type: "output_table", label: "输出表", icon: Table, desc: "将结果保存到数据表", color: "text-red-500", group: "输出" },
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>添加步骤</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
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
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">{group}</p>
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
