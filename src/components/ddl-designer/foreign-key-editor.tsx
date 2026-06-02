"use client";

import { useState, useEffect } from "react";
import { useDDLDesignerStore } from "@/stores/ddl-designer-store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";

const DELETE_ACTIONS = ["NO ACTION", "CASCADE", "SET NULL", "RESTRICT"];
const UPDATE_ACTIONS = ["NO ACTION", "CASCADE", "SET NULL", "RESTRICT"];

interface TableInfo {
  id: string;
  logicalName: string;
  physicalName: string;
  status: string;
}

export function ForeignKeyEditor({ schemaId }: { schemaId: string }) {
  const foreignKeys = useDDLDesignerStore((s) => s.foreignKeys);
  const columns = useDDLDesignerStore((s) => s.columns);
  const addForeignKey = useDDLDesignerStore((s) => s.addForeignKey);
  const updateForeignKey = useDDLDesignerStore((s) => s.updateForeignKey);
  const removeForeignKey = useDDLDesignerStore((s) => s.removeForeignKey);

  const [tables, setTables] = useState<TableInfo[]>([]);

  useEffect(() => {
    fetch(`/api/schemas/${schemaId}`)
      .then((r) => r.json())
      .then((data) => {
        setTables((data.tables || []).filter((t: TableInfo) => t.status !== "DRAFT"));
      })
      .catch(() => {});
  }, [schemaId]);

  // Build a map of physicalName → logicalName for quick lookup
  const tableMap = new Map<string, string>();
  tables.forEach((t) => tableMap.set(t.physicalName, t.logicalName));

  return (
    <div className="space-y-3">
      {foreignKeys.length === 0 && (
        <div className="py-8 text-center text-muted-foreground text-sm">
          暂无外键约束
        </div>
      )}

      {foreignKeys.map((fk) => (
        <div key={fk.id} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{fk.constraintName}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeForeignKey(fk.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">源字段</label>
              <Select
                value={fk.sourceColumnIds[0] || ""}
                onValueChange={(v) =>
                  updateForeignKey(fk.id, { sourceColumnIds: [v] })
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="选择字段" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.logicalName || col.physicalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">引用表</label>
              <Select
                value={fk.referencedPhysicalName}
                onValueChange={(v) => {
                  const logical = tableMap.get(v) || v;
                  updateForeignKey(fk.id, {
                    referencedTableName: logical,
                    referencedPhysicalName: v,
                  });
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="选择表" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((t) => (
                    <SelectItem key={t.physicalName} value={t.physicalName}>
                      {t.logicalName}
                      <span className="text-[10px] text-muted-foreground ml-2 font-mono">
                        {t.physicalName}
                      </span>
                    </SelectItem>
                  ))}
                  {tables.length === 0 && (
                    <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                      当前模型没有已创建的表
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">删除时</label>
              <Select
                value={fk.onDelete}
                onValueChange={(v) => updateForeignKey(fk.id, { onDelete: v })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELETE_ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">更新时</label>
              <Select
                value={fk.onUpdate}
                onValueChange={(v) => updateForeignKey(fk.id, { onUpdate: v })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UPDATE_ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={addForeignKey} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        添加外键
      </Button>
    </div>
  );
}
