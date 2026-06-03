"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUp, ArrowDown, X, Plus } from "lucide-react";
import { cn } from "@mizan/shared-lib/utils";

export interface ColumnMapping {
  sourceIndex: number;
  logicalName: string;
  dataType: string;
}

interface Props {
  columns: ColumnMapping[];
  onChange: (columns: ColumnMapping[]) => void;
}

const DATA_TYPES = [
  "STRING", "TEXT", "INTEGER", "BIGINT", "FLOAT",
  "BOOLEAN", "DATE", "DATETIME", "TIME", "JSON",
];

export function ColumnMappingPanel({ columns, onChange }: Props) {
  const updateCol = (idx: number, field: keyof ColumnMapping, value: string | number) => {
    const updated = columns.map((c, i) => (i === idx ? { ...c, [field]: value } : c));
    onChange(updated);
  };

  const removeCol = (idx: number) => {
    onChange(columns.filter((_, i) => i !== idx));
  };

  const moveCol = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= columns.length) return;
    const updated = [...columns];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    onChange(updated.map((c, i) => ({ ...c, sourceIndex: i })));
  };

  const addCustomCol = () => {
    onChange([...columns, { sourceIndex: columns.length, logicalName: "", dataType: "STRING" }]);
  };

  if (!columns.length) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        请先选择需要导入的列
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          字段映射 ({columns.length} 列)
        </p>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addCustomCol}>
          <Plus className="h-3 w-3 mr-1" />添加字段
        </Button>
      </div>

      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {columns.map((col, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 p-2 border rounded-lg bg-card"
          >
            <div className="flex flex-col gap-0.5">
              <button
                className="h-4 w-4 flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
                onClick={() => moveCol(idx, -1)}
                disabled={idx === 0}
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                className="h-4 w-4 flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
                onClick={() => moveCol(idx, 1)}
                disabled={idx === columns.length - 1}
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </div>

            <Badge variant="outline" className="text-[10px] shrink-0 w-6 justify-center">
              {idx + 1}
            </Badge>

            <div className="flex-1 min-w-0">
              <Input
                value={col.logicalName}
                onChange={(e) => updateCol(idx, "logicalName", e.target.value)}
                placeholder="字段名"
                className="h-7 text-xs"
              />
            </div>

            <Select
              value={col.dataType}
              onValueChange={(v) => updateCol(idx, "dataType", v)}
            >
              <SelectTrigger className="w-[110px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive shrink-0"
              onClick={() => removeCol(idx)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
