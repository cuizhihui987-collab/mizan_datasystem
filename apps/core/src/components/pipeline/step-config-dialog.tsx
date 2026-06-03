"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Combobox } from "@/components/ui/combobox";
import { Plus, Trash2 } from "lucide-react";
import {
  stepConfigFields,
  getVisibleFields,
  getNestedValue,
  setNestedValue,
  type ConfigFieldDef,
  type OptionItem,
} from "@/lib/pipeline/step-config-registry";
import {
  fetchSchemaTables,
  fetchTableColumns,
  fetchTableColumnsByPhysicalName,
  fetchImportFiles,
} from "@/lib/pipeline/fetch-options";

// ─── Props ──────────────────────────────────────────────

interface StepConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stepType: string;
  config: Record<string, unknown>;
  schemaId: string;
  /** 上一步骤的输出物理表名，用于 merge 等步骤加载左表的列 */
  prevStepPhysicalName?: string;
  onSave: (config: Record<string, unknown>) => void;
}

// ─── Main Component ─────────────────────────────────────

export function StepConfigDialog({
  open,
  onOpenChange,
  stepType,
  config,
  schemaId,
  prevStepPhysicalName,
  onSave,
}: StepConfigDialogProps) {
  const [form, setForm] = useState<Record<string, unknown>>(config);

  useEffect(() => {
    setForm(config);
  }, [config, open]);

  const update = useCallback((key: string, value: unknown) => {
    setForm((prev) => setNestedValue(prev, key, value));
  }, []);

  const handleSave = () => {
    onSave(form);
    onOpenChange(false);
  };

  const fields = stepConfigFields[stepType] || [];
  const visibleFields = getVisibleFields(fields, form);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>配置步骤</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <DynamicFieldRenderer
            fields={visibleFields}
            form={form}
            onChange={update}
            schemaId={schemaId}
            prevStepPhysicalName={prevStepPhysicalName}
          />

          {/* transform_filter 有自己独立的结构，单独渲染 */}
          {stepType === "transform_filter" && (
            <FilterForm form={form} update={update} />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={stepType === "output_table" && !form.tableName}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dynamic Field Renderer ─────────────────────────────

function DynamicFieldRenderer({
  fields,
  form,
  onChange,
  schemaId,
  prevStepPhysicalName,
}: {
  fields: ConfigFieldDef[];
  form: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  schemaId: string;
  prevStepPhysicalName?: string;
}) {
  const [optionsCache, setOptionsCache] = useState<Record<string, OptionItem[]>>({});
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({});

  // ── 加载动态选项 ──
  const loadOptions = useCallback(
    async (field: ConfigFieldDef) => {
      const cacheKey = `${field.key}_${field.optionSource}_${schemaId}`;
      setLoadingOptions((prev) => ({ ...prev, [field.key]: true }));

      try {
        let options: OptionItem[] = [];

        if (field.optionSource === "schema-tables") {
          options = await fetchSchemaTables(schemaId, field.optionValueKey);
        } else if (field.optionSource === "import-files") {
          options = await fetchImportFiles(schemaId);
        } else if (field.optionSource === "table-columns" && field.dependsOnField) {
          const depValue = String(getNestedValue(form, field.dependsOnField) || "");
          if (depValue) {
            options = await fetchTableColumnsByPhysicalName(depValue);
          }
        } else if (field.optionSource === "prev-table-columns") {
          if (prevStepPhysicalName) {
            options = await fetchTableColumnsByPhysicalName(prevStepPhysicalName);
          }
        }

        setOptionsCache((prev) => ({ ...prev, [cacheKey]: options }));
      } finally {
        setLoadingOptions((prev) => ({ ...prev, [field.key]: false }));
      }
    },
    [form, schemaId, prevStepPhysicalName]
  );

  // ── 初始加载/依赖变化时重新加载选项 ──
  useEffect(() => {
    for (const field of fields) {
      if (!field.optionSource) continue;

      const cacheKey = `${field.key}_${field.optionSource}_${schemaId}`;
      if (optionsCache[cacheKey]) continue;

      if (field.optionSource === "table-columns" && field.dependsOnField) {
        const depValue = String(getNestedValue(form, field.dependsOnField) || "");
        if (depValue) loadOptions(field);
      } else if (field.optionSource === "prev-table-columns") {
        if (prevStepPhysicalName) loadOptions(field);
      } else if (field.optionSource === "schema-tables" || field.optionSource === "import-files") {
        loadOptions(field);
      }
    }
  }, [fields, loadOptions, optionsCache, form, prevStepPhysicalName]);

  const getFieldOptions = (field: ConfigFieldDef): OptionItem[] | undefined => {
    if (field.options) return field.options;
    if (field.optionSource) {
      const cacheKey = `${field.key}_${field.optionSource}_${schemaId}`;
      return optionsCache[cacheKey];
    }
    return undefined;
  };

  return (
    <>
      {fields.map((field) => {
        const value = String(getNestedValue(form, field.key) ?? "");
        const opts = getFieldOptions(field);
        const isLoading = loadingOptions[field.key];

        return (
          <FieldWrapper key={field.key} field={field}>
            {field.type === "textarea" ? (
              <Textarea
                value={value}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="font-mono text-xs min-h-[150px]"
              />
            ) : field.type === "select" ? (
              <Select
                value={value}
                onValueChange={(v) => onChange(field.key, v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={field.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {(opts || []).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.type === "combobox" ? (
              <Combobox
                options={opts || []}
                value={value}
                onChange={(v) => onChange(field.key, v)}
                placeholder={field.placeholder || "选择或输入..."}
                allowCustom
                className={isLoading ? "opacity-60" : ""}
              />
            ) : field.type === "checkbox" ? (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={field.key}
                  checked={Boolean(getNestedValue(form, field.key))}
                  onChange={(e) => onChange(field.key, e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor={field.key} className="cursor-pointer">
                  {field.label}
                </Label>
              </div>
            ) : (
              <Input
                type={field.key === "headerRow" ? "number" : "text"}
                value={value}
                onChange={(e) =>
                  onChange(
                    field.key,
                    field.key === "headerRow"
                      ? parseInt(e.target.value) || 1
                      : e.target.value
                  )
                }
                placeholder={field.placeholder}
              />
            )}
          </FieldWrapper>
        );
      })}
    </>
  );
}

// ─── Field Wrapper (Label + Helper + Required indicator) ─

function FieldWrapper({
  field,
  children,
}: {
  field: ConfigFieldDef;
  children: React.ReactNode;
}) {
  // Checkbox 不需要外层的 Label 和边框，它自己渲染
  if (field.type === "checkbox") return <>{children}</>;

  return (
    <div>
      <Label>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {field.helperText && (
        field.type === "textarea" ? (
          <p className="text-xs text-muted-foreground mt-1 mb-2">
            {field.helperText.includes("{prev}") ? (
              <>
                使用 <code className="bg-muted px-1 rounded">{`{prev}`}</code>{" "}
                引用上一步的数据表
              </>
            ) : (
              field.helperText
            )}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">{field.helperText}</p>
        )
      )}
      {children}
    </div>
  );
}

// ─── Filter Form (transform_filter 专用) ─────────────────

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
            <div className="flex-1">
              <FilterColumnField
                value={cond.column}
                onChange={(v) => {
                  const updated = [...filters.conditions];
                  updated[idx] = { ...updated[idx], column: v };
                  setFilters({ ...filters, conditions: updated });
                }}
              />
            </div>
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

/**
 * 筛选条件中的"字段名" —— 可输入的下拉菜单。
 * 用户可以直接输入字段名，也可以通过下拉选择已有建议值。
 * 自定义输入始终被允许（allowCustom = true）。
 */
function FilterColumnField({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <Combobox
      options={[]}
      value={value}
      onChange={onChange}
      placeholder="输入字段名"
      emptyText="直接输入自定义字段名"
      allowCustom
    />
  );
}
