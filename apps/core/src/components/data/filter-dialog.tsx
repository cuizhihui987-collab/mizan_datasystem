"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  X,
  Filter,
  ListFilter,
} from "lucide-react";
import type { FilterGroup, FilterCondition } from "@/lib/query/dynamic-query-builder";

interface ColumnMeta {
  logicalName: string;
  physicalName: string;
  dataType: string;
}

interface FilterDialogProps {
  columns: ColumnMeta[];
  value: FilterGroup | undefined;
  onChange: (filters: FilterGroup | undefined) => void;
}

const OPERATORS: { value: FilterCondition["operator"]; label: string }[] = [
  { value: "eq", label: "等于" },
  { value: "neq", label: "不等于" },
  { value: "contains", label: "包含" },
  { value: "startsWith", label: "开头是" },
  { value: "endsWith", label: "结尾是" },
  { value: "gt", label: "大于" },
  { value: "gte", label: "大于等于" },
  { value: "lt", label: "小于" },
  { value: "lte", label: "小于等于" },
  { value: "isEmpty", label: "为空" },
  { value: "isNotEmpty", label: "不为空" },
];

function getOperatorLabel(op: FilterCondition["operator"]): string {
  return OPERATORS.find((o) => o.value === op)?.label || op;
}

function getColumnLabel(columns: ColumnMeta[], physicalName: string): string {
  return columns.find((c) => c.physicalName === physicalName)?.logicalName || physicalName;
}

export function FilterDialog({ columns, value, onChange }: FilterDialogProps) {
  const [open, setOpen] = useState(false);
  const [logic, setLogic] = useState<"and" | "or">(value?.logic || "and");
  const [conditions, setConditions] = useState<FilterCondition[]>(value?.conditions || []);

  const userColumns = columns.filter(
    (c) => !["_id", "_created_at", "_updated_at"].includes(c.physicalName)
  );

  // Sync local state when dialog opens
  useEffect(() => {
    if (open) {
      setLogic(value?.logic || "and");
      setConditions(value?.conditions || []);
    }
  }, [open, value]);

  const addCondition = () => {
    const firstCol = userColumns[0];
    if (!firstCol) return;
    setConditions((prev) => [
      ...prev,
      { column: firstCol.physicalName, operator: "contains", value: "" },
    ]);
  };

  const updateCondition = (idx: number, field: keyof FilterCondition, val: string) => {
    setConditions((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: val } : c))
    );
  };

  const removeCondition = (idx: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleApply = () => {
    const valid = conditions.filter((c) => {
      // isEmpty/isNotEmpty don't need a value
      if (c.operator === "isEmpty" || c.operator === "isNotEmpty") return true;
      return c.column && c.value !== "";
    });
    if (valid.length === 0) {
      onChange(undefined);
    } else {
      onChange({ logic, conditions: valid });
    }
    setOpen(false);
  };

  const handleClear = () => {
    setConditions([]);
    onChange(undefined);
    setOpen(false);
  };

  const activeCount = value?.conditions?.length || 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <ListFilter className="h-4 w-4 mr-1" />
          筛选
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>数据筛选</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 py-2">
          {conditions.map((cond, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 border rounded-md bg-muted/20">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Column */}
                <Select
                  value={cond.column}
                  onValueChange={(v) => updateCondition(idx, "column", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择字段" />
                  </SelectTrigger>
                  <SelectContent>
                    {userColumns.map((col) => (
                      <SelectItem key={col.physicalName} value={col.physicalName}>
                        {col.logicalName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Operator */}
                <Select
                  value={cond.operator}
                  onValueChange={(v) => updateCondition(idx, "operator", v as FilterCondition["operator"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Value */}
                {cond.operator !== "isEmpty" && cond.operator !== "isNotEmpty" ? (
                  <Input
                    type="text"
                    value={cond.value}
                    onChange={(e) => updateCondition(idx, "value", e.target.value)}
                    placeholder="输入值"
                  />
                ) : (
                  <div className="flex items-center text-sm text-muted-foreground px-2">
                    — 无需值 —
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeCondition(idx)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={addCondition}
            disabled={userColumns.length === 0}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-1" />
            添加条件
          </Button>
        </div>

        {/* Logic toggle + Actions */}
        <div className="flex items-center justify-between pt-3 border-t shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">条件关系：</span>
            <div className="flex border rounded-md overflow-hidden">
              <button
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  logic === "and"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent"
                }`}
                onClick={() => setLogic("and")}
              >
                且 (AND)
              </button>
              <button
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  logic === "or"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent"
                }`}
                onClick={() => setLogic("or")}
              >
                或 (OR)
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleClear}>
              清除筛选
            </Button>
            <DialogClose asChild>
              <Button variant="outline" size="sm">取消</Button>
            </DialogClose>
            <Button size="sm" onClick={handleApply}>
              应用
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Renders active filter conditions as badges below the toolbar */
export function FilterBadges({
  filters,
  columns,
  onRemove,
  onClear,
}: {
  filters: FilterGroup | undefined;
  columns: ColumnMeta[];
  onRemove: (idx: number) => void;
  onClear: () => void;
}) {
  if (!filters || filters.conditions.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap text-xs">
      <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {filters.conditions.map((cond, idx) => (
        <Badge key={idx} variant="secondary" className="gap-1 px-2 py-0.5 text-[11px]">
          <span>{getColumnLabel(columns, cond.column)}</span>
          <span className="text-muted-foreground">{getOperatorLabel(cond.operator)}</span>
          {cond.operator !== "isEmpty" && cond.operator !== "isNotEmpty" && (
            <span className="font-mono max-w-[100px] truncate inline-block align-bottom">
              &ldquo;{cond.value}&rdquo;
            </span>
          )}
          <button
            onClick={() => onRemove(idx)}
            className="hover:text-destructive ml-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {filters.conditions.length > 1 && (
        <span className="text-muted-foreground italic">
          ({filters.logic === "or" ? "或" : "且"})
        </span>
      )}
      <button
        onClick={onClear}
        className="text-muted-foreground hover:text-foreground ml-1 underline"
      >
        清除全部
      </button>
    </div>
  );
}
