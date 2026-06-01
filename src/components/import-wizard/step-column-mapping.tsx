"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ArrowUpDown, Key, Trash2 } from "lucide-react";

const DATA_TYPES = [
  { value: "STRING", label: "STRING (字符串)" },
  { value: "TEXT", label: "TEXT (长文本)" },
  { value: "INTEGER", label: "INTEGER (整数)" },
  { value: "BIGINT", label: "BIGINT (长整数)" },
  { value: "FLOAT", label: "FLOAT (浮点数)" },
  { value: "BOOLEAN", label: "BOOLEAN (布尔)" },
  { value: "DATE", label: "DATE (日期)" },
  { value: "DATETIME", label: "DATETIME (日期时间)" },
  { value: "TIME", label: "TIME (时间)" },
  { value: "JSON", label: "JSON" },
];

export interface ColumnMapping {
  sourceName: string;
  logicalName: string;
  dataType: string;
  isPrimaryKey: boolean;
  isNullable: boolean;
}

interface StepColumnMappingProps {
  headers: string[];
  suggestedTypes: Array<{
    columnIndex: number;
    columnName: string;
    detectedType: string;
    confidence: number;
    nullCount: number;
  }>;
  onConfirm: (columns: ColumnMapping[], tableName: string) => void;
  onBack: () => void;
  defaultTableName: string;
}

export function StepColumnMapping({
  headers,
  suggestedTypes,
  onConfirm,
  onBack,
  defaultTableName,
}: StepColumnMappingProps) {
  const [tableName, setTableName] = useState(defaultTableName);
  const [columns, setColumns] = useState<ColumnMapping[]>(() =>
    headers.map((header, i) => ({
      sourceName: header,
      logicalName: header,
      dataType: suggestedTypes[i]?.detectedType || "STRING",
      isPrimaryKey: false,
      isNullable: true,
    }))
  );

  const updateColumn = (index: number, updates: Partial<ColumnMapping>) => {
    setColumns((prev) =>
      prev.map((col, i) => (i === index ? { ...col, ...updates } : col))
    );
  };

  const removeColumn = (index: number) => {
    setColumns((prev) => prev.filter((_, i) => i !== index));
  };

  const addColumn = () => {
    setColumns((prev) => [
      ...prev,
      {
        sourceName: "",
        logicalName: "",
        dataType: "STRING",
        isPrimaryKey: false,
        isNullable: true,
      },
    ]);
  };

  const moveColumn = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= columns.length) return;
    const newCols = [...columns];
    const [moved] = newCols.splice(fromIdx, 1);
    newCols.splice(toIdx, 0, moved);
    setColumns(newCols);
  };

  const headerOptions: ComboboxOption[] = headers
    .filter((h) => h)
    .map((h) => ({ label: h, value: h }));

  const getTypeConfidence = (sourceName: string) => {
    const st = suggestedTypes.find((t) => t.columnName === sourceName);
    return st ? st.confidence : 0;
  };

  const canConfirm = columns.some((c) => c.logicalName.trim()) && tableName.trim();

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium">表名称</label>
          <input
            type="text"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="输入表名称"
          />
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        共 {columns.length} 个字段
      </div>

      <div className="space-y-2">
        {columns.map((col, index) => {
          const typeConfidence = col.sourceName ? getTypeConfidence(col.sourceName) : 0;
          const isNewColumn = !col.sourceName;

          return (
            <Card key={index} className={col.isPrimaryKey ? "border-amber-300" : ""}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  {/* Drag handle */}
                  <div className="flex flex-col gap-0.5 pt-2">
                    <button
                      type="button"
                      onClick={() => moveColumn(index, index - 1)}
                      disabled={index === 0}
                      className="h-3 w-4 text-muted-foreground hover:text-foreground disabled:opacity-20"
                    >
                      <ArrowUpDown className="h-3 w-3 rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveColumn(index, index + 1)}
                      disabled={index === columns.length - 1}
                      className="h-3 w-4 text-muted-foreground hover:text-foreground disabled:opacity-20"
                    >
                      <ArrowUpDown className="h-3 w-3 rotate-90" />
                    </button>
                  </div>

                  {/* PK badge */}
                  <div className="pt-2">
                    <Key
                      className={cn(
                        "h-4 w-4",
                        col.isPrimaryKey
                          ? "text-amber-500"
                          : "text-muted-foreground/30"
                      )}
                    />
                  </div>

                  {/* Column fields */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Row 1: Field name combobox */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <label className="text-xs text-muted-foreground mb-1 block">
                          字段名称
                        </label>
                        <Combobox
                          options={isNewColumn ? [] : headerOptions}
                          value={col.logicalName}
                          onChange={(val) =>
                            updateColumn(index, { logicalName: val })
                          }
                          placeholder="输入字段名称"
                          emptyText="直接输入自定义名称"
                        />
                      </div>
                      {!isNewColumn && (
                        <button
                          type="button"
                          onClick={() => {
                            
                            updateColumn(index, {
                              logicalName: col.sourceName,
                            });
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground mt-5 shrink-0"
                          title="恢复为原始名称"
                        >
                          还原
                        </button>
                      )}
                    </div>

                    {/* Row 2: Data type + PK + Nullable */}
                    <div className="flex items-end gap-3">
                      <div className="w-44">
                        <label className="text-xs text-muted-foreground mb-1 block">
                          数据类型
                          {col.sourceName && typeConfidence > 0 && (
                            <span className="ml-1">
                              <Badge
                                variant={
                                  typeConfidence > 0.8
                                    ? "default"
                                    : typeConfidence > 0.5
                                    ? "secondary"
                                    : "outline"
                                }
                                className="text-[10px] px-1 py-0"
                              >
                                {Math.round(typeConfidence * 100)}%
                              </Badge>
                            </span>
                          )}
                        </label>
                        <Select
                          value={col.dataType}
                          onValueChange={(val) =>
                            updateColumn(index, { dataType: val })
                          }
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DATA_TYPES.map((dt) => (
                              <SelectItem key={dt.value} value={dt.value}>
                                {dt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-4 pb-1">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={col.isPrimaryKey}
                            onCheckedChange={(checked) =>
                              updateColumn(index, {
                                isPrimaryKey: checked === true,
                              })
                            }
                          />
                          <span className="text-xs text-muted-foreground">
                            主键
                          </span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={!col.isNullable}
                            onCheckedChange={(checked) =>
                              updateColumn(index, {
                                isNullable: checked !== true,
                              })
                            }
                          />
                          <span className="text-xs text-muted-foreground">
                            NOT NULL
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeColumn(index)}
                    className="pt-2 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button variant="outline" size="sm" onClick={addColumn} className="w-full">
        + 添加字段
      </Button>

      <Separator />

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          返回
        </Button>
        <Button
          onClick={() => onConfirm(columns, tableName)}
          disabled={!canConfirm}
        >
          确认并创建表
        </Button>
      </div>
    </div>
  );
}
