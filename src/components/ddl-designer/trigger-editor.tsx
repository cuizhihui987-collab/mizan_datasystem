"use client";

import { useDDLDesignerStore } from "@/stores/ddl-designer-store";
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
import { Trash2, Plus } from "lucide-react";

const TIMING_OPTIONS = ["BEFORE", "AFTER", "INSTEAD OF"];
const EVENT_OPTIONS = ["INSERT", "UPDATE", "DELETE"];

export function TriggerEditor() {
  const triggers = useDDLDesignerStore((s) => s.triggers);
  const addTrigger = useDDLDesignerStore((s) => s.addTrigger);
  const updateTrigger = useDDLDesignerStore((s) => s.updateTrigger);
  const removeTrigger = useDDLDesignerStore((s) => s.removeTrigger);

  return (
    <div className="space-y-3">
      {triggers.length === 0 && (
        <div className="py-8 text-center text-muted-foreground text-sm">
          暂无触发器
        </div>
      )}

      {triggers.map((tr) => (
        <div key={tr.id} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Input
                value={tr.triggerName}
                onChange={(e) =>
                  updateTrigger(tr.id, { triggerName: e.target.value })
                }
                className="h-8 w-48 font-mono text-xs"
                placeholder="触发器名称"
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={tr.enabled}
                  onCheckedChange={(v) =>
                    updateTrigger(tr.id, { enabled: v === true })
                  }
                />
                启用
              </label>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeTrigger(tr.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">触发时机</label>
              <Select
                value={tr.timing}
                onValueChange={(v) => updateTrigger(tr.id, { timing: v })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMING_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">触发事件</label>
              <Select
                value={tr.event}
                onValueChange={(v) => updateTrigger(tr.id, { event: v })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_OPTIONS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">触发逻辑 (SQL)</label>
            <textarea
              value={tr.logic}
              onChange={(e) =>
                updateTrigger(tr.id, { logic: e.target.value })
              }
              className="w-full h-24 rounded-md border border-input bg-background p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="-- 示例: UPDATE other_table SET count = count + 1 WHERE id = NEW.id;"
            />
          </div>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={addTrigger} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        添加触发器
      </Button>
    </div>
  );
}
