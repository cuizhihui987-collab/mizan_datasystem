"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHART_TYPES } from "@/components/charts/chart-utils";

interface TableDef {
  id: string;
  logicalName: string;
  physicalName: string;
  status: string;
}

interface WidgetConfig {
  title?: string;
  tableId: string;
  chartType: string;
  xAxis: string;
  yAxes: string[];
  config: Record<string, unknown>;
}

interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schemaId: string;
  onConfirm: (config: WidgetConfig) => void;
}

export function AddWidgetDialog({
  open,
  onOpenChange,
  schemaId,
  onConfirm,
}: AddWidgetDialogProps) {
  const [title, setTitle] = useState("");
  const [tableId, setTableId] = useState("");
  const [chartType, setChartType] = useState("bar");

  const { data: tables } = useQuery<TableDef[]>({
    queryKey: ["schema-tables", schemaId],
    queryFn: async () => {
      const res = await fetch(`/api/schemas/${schemaId}?tables=true`);
      if (!res.ok) return [];
      const schema = await res.json();
      return (schema.tables || []).filter((t: TableDef) => t.status !== "DRAFT");
    },
    enabled: open,
  });

  const handleConfirm = () => {
    if (!tableId) return;
    onConfirm({
      title: title || undefined,
      tableId,
      chartType,
      xAxis: "",
      yAxes: [],
      config: {},
    });
    setTitle("");
    setTableId("");
    setChartType("bar");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>添加图表</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium">图表标题（可选）</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：商品销售趋势"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">数据表</label>
            <Select value={tableId} onValueChange={setTableId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="选择数据表..." />
              </SelectTrigger>
              <SelectContent>
                {(tables || []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.logicalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">图表类型</label>
            <Select value={chartType} onValueChange={setChartType}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_TYPES.map((ct) => (
                  <SelectItem key={ct.value} value={ct.value}>
                    {ct.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            创建后可以在看板中编辑图表的详细配置（轴字段、聚合方式等）
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={!tableId}>
            添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
