"use client";

import { useDDLDesignerStore, type ColumnFormData } from "@/stores/ddl-designer-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GripVertical, Trash2, Plus } from "lucide-react";

const DATA_TYPES = [
  { value: "STRING", label: "字符串 (VARCHAR)" },
  { value: "TEXT", label: "长文本 (TEXT)" },
  { value: "INTEGER", label: "整数 (INTEGER)" },
  { value: "BIGINT", label: "长整数 (BIGINT)" },
  { value: "FLOAT", label: "浮点数 (FLOAT)" },
  { value: "DOUBLE", label: "双精度 (DOUBLE)" },
  { value: "BOOLEAN", label: "布尔 (BOOLEAN)" },
  { value: "DATE", label: "日期 (DATE)" },
  { value: "DATETIME", label: "日期时间 (DATETIME)" },
  { value: "TIME", label: "时间 (TIME)" },
  { value: "JSON", label: "JSON" },
];

function toSafeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 64) || "col";
}

function ColumnEditorRow({ column }: { column: ColumnFormData }) {
  const updateColumn = useDDLDesignerStore((s) => s.updateColumn);
  const removeColumn = useDDLDesignerStore((s) => s.removeColumn);

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">字段名称</label>
            <Input
              value={column.logicalName}
              onChange={(e) => {
                const name = e.target.value;
                updateColumn(column.id, {
                  logicalName: name,
                  physicalName: toSafeName(name),
                });
              }}
              placeholder="例如: 商品名称"
              className="h-8"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">物理名称</label>
            <Input
              value={column.physicalName}
              onChange={(e) =>
                updateColumn(column.id, {
                  physicalName: toSafeName(e.target.value),
                })
              }
              className="h-8 font-mono text-xs"
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => removeColumn(column.id)}
          className="shrink-0"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">数据类型</label>
          <Select
            value={column.dataType}
            onValueChange={(v) => updateColumn(column.id, { dataType: v })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATA_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {column.dataType === "STRING" && (
          <div>
            <label className="text-xs text-muted-foreground">长度</label>
            <Input
              type="number"
              defaultValue={255}
              className="h-8"
              onChange={(e) =>
                updateColumn(column.id, {
                  dataTypeArgs: JSON.stringify({
                    length: Number(e.target.value) || 255,
                  }),
                })
              }
            />
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground">默认值</label>
          <Input
            value={column.defaultValue}
            onChange={(e) =>
              updateColumn(column.id, { defaultValue: e.target.value })
            }
            placeholder="NULL"
            className="h-8 font-mono text-xs"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={column.isPrimaryKey}
            onCheckedChange={(v) =>
              updateColumn(column.id, { isPrimaryKey: v === true })
            }
          />
          主键
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={!column.isNullable}
            onCheckedChange={(v) =>
              updateColumn(column.id, { isNullable: v !== true })
            }
          />
          非空
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={column.isUnique}
            onCheckedChange={(v) =>
              updateColumn(column.id, { isUnique: v === true })
            }
          />
          唯一
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={column.autoIncrement}
            onCheckedChange={(v) =>
              updateColumn(column.id, { autoIncrement: v === true })
            }
          />
          自增
        </label>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">CHECK 约束（可选）</label>
        <Input
          value={column.checkExpression}
          onChange={(e) =>
            updateColumn(column.id, { checkExpression: e.target.value })
          }
          placeholder='例如: price > 0'
          className="h-8 font-mono text-xs"
        />
      </div>
    </div>
  );
}

export function ColumnList() {
  const columns = useDDLDesignerStore((s) => s.columns);
  const addColumn = useDDLDesignerStore((s) => s.addColumn);

  return (
    <div className="space-y-3">
      {columns.map((col) => (
        <ColumnEditorRow key={col.id} column={col} />
      ))}
      <Button variant="outline" size="sm" onClick={addColumn} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        添加字段
      </Button>
    </div>
  );
}
