"use client";

import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

interface StepConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stepType: string;
  config: Record<string, unknown>;
  schemaId: string;
  onSave: (config: Record<string, unknown>) => void;
}

interface TableDef {
  id: string;
  logicalName: string;
  physicalName: string;
  status: string;
}

export function StepConfigDialog({
  open,
  onOpenChange,
  stepType,
  config,
  schemaId,
  onSave,
}: StepConfigDialogProps) {
  const [form, setForm] = useState<Record<string, unknown>>(config);

  useEffect(() => {
    setForm(config);
  }, [config, open]);

  const { data: tables } = useQuery<TableDef[]>({
    queryKey: ["schema-tables", schemaId],
    queryFn: async () => {
      const res = await fetch(`/api/schemas/${schemaId}?tables=true`);
      if (!res.ok) return [];
      const schema = await res.json();
      return (schema.tables || []).filter((t: TableDef) => t.status !== "DRAFT");
    },
    enabled: open && ["source_table", "transform_merge", "output_table"].includes(stepType),
  });

  const update = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>配置步骤</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ── source_table ── */}
          {stepType === "source_table" && (
            <div>
              <Label>选择源数据表</Label>
              <Select
                value={String(form.sourceTableId || "")}
                onValueChange={(v) => update("sourceTableId", v)}
              >
                <SelectTrigger>
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
          )}

          {/* ── source_import ── */}
          {stepType === "source_import" && (
            <>
              <div>
                <Label>选择已上传的文件</Label>
                <p className="text-xs text-muted-foreground mt-1">需要先通过导入功能上传文件，然后在此选择文件 ID</p>
                <Input
                  value={String(form.fileId || "")}
                  onChange={(e) => update("fileId", e.target.value)}
                  placeholder="文件 ID"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>表头行号</Label>
                <Input
                  type="number"
                  value={String(form.headerRow || "1")}
                  onChange={(e) => update("headerRow", parseInt(e.target.value) || 1)}
                />
              </div>
            </>
          )}

          {/* ── source_api ── */}
          {stepType === "source_api" && (
            <>
              <div>
                <Label>API 端点 URL</Label>
                <Input
                  value={String(form.endpoint || "")}
                  onChange={(e) => update("endpoint", e.target.value)}
                  placeholder="https://api.example.com/data"
                />
              </div>
              <div>
                <Label>请求方法</Label>
                <Select
                  value={String(form.method || "GET")}
                  onValueChange={(v) => update("method", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>认证方式</Label>
                <Select
                  value={String(form.authType || "none")}
                  onValueChange={(v) => update("authType", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">无认证</SelectItem>
                    <SelectItem value="basic">Basic Auth</SelectItem>
                    <SelectItem value="token">Bearer Token</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.authType === "basic" && (
                <>
                  <div>
                    <Label>用户名</Label>
                    <Input value={String((form.authConfig as Record<string, string>)?.username || "")} onChange={(e) => update("authConfig", { ...(form.authConfig as object || {}), username: e.target.value })} />
                  </div>
                  <div>
                    <Label>密码</Label>
                    <Input type="password" value={String((form.authConfig as Record<string, string>)?.password || "")} onChange={(e) => update("authConfig", { ...(form.authConfig as object || {}), password: e.target.value })} />
                  </div>
                </>
              )}
              {form.authType === "token" && (
                <div>
                  <Label>Token</Label>
                  <Input value={String((form.authConfig as Record<string, string>)?.token || "")} onChange={(e) => update("authConfig", { ...(form.authConfig as object || {}), token: e.target.value })} />
                </div>
              )}
            </>
          )}

          {/* ── transform_sql ── */}
          {stepType === "transform_sql" && (
            <div>
              <Label>SQL 查询</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                使用 <code className="bg-muted px-1 rounded">{`{prev}`}</code> 引用上一步的数据表
              </p>
              <Textarea
                value={String(form.sql || "")}
                onChange={(e) => update("sql", e.target.value)}
                placeholder={`SELECT * FROM {prev} WHERE ...`}
                className="font-mono text-xs min-h-[150px]"
              />
            </div>
          )}

          {/* ── transform_merge ── */}
          {stepType === "transform_merge" && (
            <>
              <div>
                <Label>合并方式</Label>
                <Select
                  value={String(form.joinType || "INNER")}
                  onValueChange={(v) => update("joinType", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INNER">INNER JOIN（内连接）</SelectItem>
                    <SelectItem value="LEFT">LEFT JOIN（左连接）</SelectItem>
                    <SelectItem value="RIGHT">RIGHT JOIN（右连接）</SelectItem>
                    <SelectItem value="FULL">FULL JOIN（全连接）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>关联的右表</Label>
                <Select
                  value={String(form.rightSource || "")}
                  onValueChange={(v) => update("rightSource", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择关联表..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(tables || []).map((t) => (
                      <SelectItem key={t.id} value={t.physicalName}>
                        {t.logicalName} ({t.physicalName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>左表关联字段</Label>
                  <Input
                    value={String(form.leftOn || "")}
                    onChange={(e) => update("leftOn", e.target.value)}
                    placeholder="字段名"
                  />
                </div>
                <div>
                  <Label>右表关联字段</Label>
                  <Input
                    value={String(form.rightOn || "")}
                    onChange={(e) => update("rightOn", e.target.value)}
                    placeholder="字段名"
                  />
                </div>
              </div>
            </>
          )}

          {/* ── transform_filter ── */}
          {stepType === "transform_filter" && (
            <FilterForm form={form} update={update} />
          )}

          {/* ── output_table ── */}
          {stepType === "output_table" && (
            <>
              <div>
                <Label>输出表名</Label>
                <Input
                  value={String(form.tableName || "")}
                  onChange={(e) => update("tableName", e.target.value)}
                  placeholder="例如：清洗后商品数据"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="overwrite"
                  checked={Boolean(form.overwriteIfExists)}
                  onChange={(e) => update("overwriteIfExists", e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="overwrite" className="cursor-pointer">
                  如果表已存在则覆盖
                </Label>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={stepType === "output_table" && !form.tableName}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Filter form sub-component ──
function FilterForm({
  form,
  update,
}: {
  form: Record<string, unknown>;
  update: (key: string, val: unknown) => void;
}) {
  const filters = (form.filters as {
    logic: string;
    conditions: { column: string; operator: string; value: string }[];
  }) || { logic: "and", conditions: [{ column: "", operator: "eq", value: "" }] };

  const setFilters = (f: typeof filters) => {
    update("filters", f);
  };

  const addCondition = () => {
    setFilters({
      ...filters,
      conditions: [...filters.conditions, { column: "", operator: "eq", value: "" }],
    });
  };

  const removeCondition = (idx: number) => {
    const updated = filters.conditions.filter((_, i) => i !== idx);
    setFilters({ ...filters, conditions: updated });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>筛选逻辑</Label>
        <Select
          value={filters.logic}
          onValueChange={(v) => setFilters({ ...filters, logic: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="and">全部满足（AND）</SelectItem>
            <SelectItem value="or">满足任一（OR）</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>条件</Label>
        {filters.conditions.map((cond, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              className="flex-1"
              placeholder="字段名"
              value={cond.column}
              onChange={(e) => {
                const updated = [...filters.conditions];
                updated[idx] = { ...updated[idx], column: e.target.value };
                setFilters({ ...filters, conditions: updated });
              }}
            />
            <Select
              value={cond.operator}
              onValueChange={(v) => {
                const updated = [...filters.conditions];
                updated[idx] = { ...updated[idx], operator: v };
                setFilters({ ...filters, conditions: updated });
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eq">等于</SelectItem>
                <SelectItem value="neq">不等于</SelectItem>
                <SelectItem value="contains">包含</SelectItem>
                <SelectItem value="gt">大于</SelectItem>
                <SelectItem value="gte">大于等于</SelectItem>
                <SelectItem value="lt">小于</SelectItem>
                <SelectItem value="lte">小于等于</SelectItem>
                <SelectItem value="isEmpty">为空</SelectItem>
                <SelectItem value="isNotEmpty">不为空</SelectItem>
              </SelectContent>
            </Select>
            {cond.operator !== "isEmpty" && cond.operator !== "isNotEmpty" && (
              <Input
                className="w-[130px]"
                placeholder="值"
                value={cond.value}
                onChange={(e) => {
                  const updated = [...filters.conditions];
                  updated[idx] = { ...updated[idx], value: e.target.value };
                  setFilters({ ...filters, conditions: updated });
                }}
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-destructive shrink-0"
              onClick={() => removeCondition(idx)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addCondition}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          添加条件
        </Button>
      </div>
    </div>
  );
}
