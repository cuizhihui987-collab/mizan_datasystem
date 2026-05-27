"use client";

import { useDDLDesignerStore } from "@/stores/ddl-designer-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function ForeignKeyEditor() {
  const foreignKeys = useDDLDesignerStore((s) => s.foreignKeys);
  const columns = useDDLDesignerStore((s) => s.columns);
  const addForeignKey = useDDLDesignerStore((s) => s.addForeignKey);
  const updateForeignKey = useDDLDesignerStore((s) => s.updateForeignKey);
  const removeForeignKey = useDDLDesignerStore((s) => s.removeForeignKey);

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
              <label className="text-xs text-muted-foreground">引用表（物理名）</label>
              <Input
                value={fk.referencedPhysicalName}
                onChange={(e) =>
                  updateForeignKey(fk.id, {
                    referencedTableName: e.target.value,
                    referencedPhysicalName: e.target.value,
                  })
                }
                placeholder="例如: mzan_tbl_xxx"
                className="h-8 font-mono text-xs"
              />
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
