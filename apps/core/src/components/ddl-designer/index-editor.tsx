"use client";

import { useDDLDesignerStore } from "@/stores/ddl-designer-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus } from "lucide-react";

export function IndexEditor() {
  const indexes = useDDLDesignerStore((s) => s.indexes);
  const columns = useDDLDesignerStore((s) => s.columns);
  const addIndex = useDDLDesignerStore((s) => s.addIndex);
  const updateIndex = useDDLDesignerStore((s) => s.updateIndex);
  const removeIndex = useDDLDesignerStore((s) => s.removeIndex);

  return (
    <div className="space-y-3">
      {indexes.length === 0 && (
        <div className="py-8 text-center text-muted-foreground text-sm">
          暂无索引
        </div>
      )}

      {indexes.map((idx) => (
        <div key={idx.id} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Input
              value={idx.indexName}
              onChange={(e) =>
                updateIndex(idx.id, { indexName: e.target.value })
              }
              className="h-8 w-48 font-mono text-xs"
              placeholder="索引名称"
            />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={idx.isUnique}
                  onCheckedChange={(v) =>
                    updateIndex(idx.id, { isUnique: v === true })
                  }
                />
                唯一
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeIndex(idx.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">包含字段</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {columns.map((col) => (
                <label
                  key={col.id}
                  className={`px-2 py-1 rounded-md text-xs cursor-pointer border transition-colors
                    ${idx.columnIds.includes(col.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-accent"}`}
                  onClick={() => {
                    const newIds = idx.columnIds.includes(col.id)
                      ? idx.columnIds.filter((id) => id !== col.id)
                      : [...idx.columnIds, col.id];
                    updateIndex(idx.id, { columnIds: newIds });
                  }}
                >
                  {col.logicalName || col.physicalName}
                </label>
              ))}
            </div>
          </div>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={addIndex} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        添加索引
      </Button>
    </div>
  );
}
