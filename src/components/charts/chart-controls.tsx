"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CHART_TYPES, AGGREGATION_OPTIONS, type ColumnMeta, type ChartType, type AggregationMode } from "./chart-utils";

interface ChartControlsProps {
  chartType: ChartType;
  onChartTypeChange: (v: ChartType) => void;
  xAxis: string;
  onXAxisChange: (v: string) => void;
  yAxes: string[];
  onYAxesChange: (v: string[]) => void;
  yAxis2: string;
  onYAxis2Change: (v: string) => void;
  colorGroup: string;
  onColorGroupChange: (v: string) => void;
  aggregation: AggregationMode;
  onAggregationChange: (v: AggregationMode) => void;
  stacked: boolean;
  onStackedChange: (v: boolean) => void;
  showLabels: boolean;
  onShowLabelsChange: (v: boolean) => void;
  smooth: boolean;
  onSmoothChange: (v: boolean) => void;
  sortBy: string;
  onSortByChange: (v: string) => void;
  sortOrder: "asc" | "desc";
  onSortOrderChange: (v: "asc" | "desc") => void;
  textColumns: ColumnMeta[];
  numericColumns: ColumnMeta[];
}

export function ChartControls({
  chartType,
  onChartTypeChange,
  xAxis,
  onXAxisChange,
  yAxes,
  onYAxesChange,
  yAxis2,
  onYAxis2Change,
  colorGroup,
  onColorGroupChange,
  aggregation,
  onAggregationChange,
  stacked,
  onStackedChange,
  showLabels,
  onShowLabelsChange,
  smooth,
  onSmoothChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  textColumns,
  numericColumns,
}: ChartControlsProps) {
  const toggleYAxis = (colName: string) => {
    if (yAxes.includes(colName)) {
      onYAxesChange(yAxes.filter((y) => y !== colName));
    } else {
      onYAxesChange([...yAxes, colName]);
    }
  };

  const numericColOptions = numericColumns.map((col) => ({
    value: col.physicalName,
    label: col.logicalName || col.physicalName,
  }));

  const textColOptions = textColumns.map((col) => ({
    value: col.physicalName,
    label: col.logicalName || col.physicalName,
  }));

  return (
    <div className="space-y-3">
      {/* Row 1: Chart type + Aggregation + Sort */}
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[130px] flex-1">
          <label className="text-xs text-muted-foreground">图表类型</label>
          <Select
            value={chartType}
            onValueChange={(v) => {
              onChartTypeChange(v as ChartType);
              onColorGroupChange("");
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHART_TYPES.map((ct) => (
                <SelectItem key={ct.value} value={ct.value}>
                  {ct.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {chartType !== "heatmap" && chartType !== "radar" && (
          <div className="min-w-[110px] flex-1">
            <label className="text-xs text-muted-foreground">聚合方式</label>
            <Select
              value={aggregation}
              onValueChange={(v) => onAggregationChange(v as AggregationMode)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGGREGATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Sort */}
        {(aggregation !== "none" || chartType === "bar") && (
          <div className="min-w-[110px] flex-1">
            <label className="text-xs text-muted-foreground">排序</label>
            <Select value={sortBy} onValueChange={onSortByChange}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="不排序" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">不排序</SelectItem>
                {numericColumns.map((col) => (
                  <SelectItem key={col.physicalName} value={col.physicalName}>
                    {col.logicalName || col.physicalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {sortBy && sortBy !== "_none" && (
          <div className="min-w-[80px] flex-1">
            <label className="text-xs text-muted-foreground">排序方向</label>
            <Select
              value={sortOrder}
              onValueChange={(v) => onSortOrderChange(v as "asc" | "desc")}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">升序 ↑</SelectItem>
                <SelectItem value="desc">降序 ↓</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Row 2: Axis selectors */}
      <div className="flex flex-wrap gap-3">
        {/* X Axis */}
        {chartType !== "heatmap" && (
          <div className="min-w-[130px] flex-1">
            <label className="text-xs text-muted-foreground">
              {chartType === "scatter" ? "X 轴 (数值)" : "X 轴 (分类)"}
            </label>
            <Select value={xAxis} onValueChange={onXAxisChange}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="选择字段" />
              </SelectTrigger>
              <SelectContent>
                {(chartType === "scatter" ? numericColumns : textColumns).map(
                  (col) => (
                    <SelectItem key={col.physicalName} value={col.physicalName}>
                      {col.logicalName || col.physicalName}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Y Axis (multi-select for most types) — hidden for radar and heatmap */}
        {chartType !== "heatmap" && chartType !== "radar" && (
          <div className="min-w-[180px] flex-1">
            <label className="text-xs text-muted-foreground">Y 轴 (数值，可多选)</label>
            <div className="flex flex-wrap gap-1.5 mt-1 max-h-[120px] overflow-y-auto border rounded-md p-1.5">
              {numericColumns.length === 0 && (
                <span className="text-xs text-muted-foreground px-1">无数值字段</span>
              )}
              {numericColumns.map((col) => {
                const name = col.physicalName;
                const label = col.logicalName || name;
                return (
                  <label
                    key={name}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs cursor-pointer transition-colors ${
                      yAxes.includes(name)
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "hover:bg-accent border border-transparent"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={yAxes.includes(name)}
                      onChange={() => toggleYAxis(name)}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Heatmap X axis */}
        {chartType === "heatmap" && (
          <div className="min-w-[130px] flex-1">
            <label className="text-xs text-muted-foreground">X 轴 (分类)</label>
            <Select value={xAxis} onValueChange={onXAxisChange}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="选择字段" />
              </SelectTrigger>
              <SelectContent>
                {textColOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Row 3: Chart-specific extra controls */}
      <div className="flex flex-wrap gap-3">
        {/* Combo: second Y axis */}
        {chartType === "combo" && (
          <div className="min-w-[130px] flex-1">
            <label className="text-xs text-muted-foreground">折线轴 (右轴)</label>
            <Select value={yAxis2} onValueChange={onYAxis2Change}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="选择字段" />
              </SelectTrigger>
              <SelectContent>
                {numericColumns
                  .filter((c) => !yAxes.includes(c.physicalName))
                  .map((col) => (
                    <SelectItem key={col.physicalName} value={col.physicalName}>
                      {col.logicalName || col.physicalName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Scatter: color group */}
        {chartType === "scatter" && (
          <div className="min-w-[130px] flex-1">
            <label className="text-xs text-muted-foreground">颜色分组</label>
            <Select
              value={colorGroup}
              onValueChange={(v) => onColorGroupChange(v === "_none" ? "" : v)}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="不分" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">不分</SelectItem>
                {textColOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Heatmap: Y category + value */}
        {chartType === "heatmap" && (
          <>
            <div className="min-w-[130px] flex-1">
              <label className="text-xs text-muted-foreground">Y 轴 (分类)</label>
              <Select value={yAxis2 || xAxis} onValueChange={onYAxis2Change}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="选择字段" />
                </SelectTrigger>
                <SelectContent>
                  {textColOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[130px] flex-1">
              <label className="text-xs text-muted-foreground">数值 (聚合)</label>
              <Select
                value={yAxes[0] || ""}
                onValueChange={(v) => onYAxesChange([v])}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="选择字段" />
                </SelectTrigger>
                <SelectContent>
                  {numericColOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />
      </div>

      {/* Row 4: Toggle options */}
      {chartType !== "scatter" && chartType !== "heatmap" && chartType !== "radar" && (
        <div className="flex flex-wrap items-center gap-4 pt-1">
          {(chartType === "bar" || chartType === "area") && (
            <div className="flex items-center gap-2">
              <Switch
                id="stacked"
                checked={stacked}
                onCheckedChange={onStackedChange}
              />
              <Label htmlFor="stacked" className="text-xs cursor-pointer">
                堆叠
              </Label>
            </div>
          )}

          {["line", "area"].includes(chartType) && (
            <div className="flex items-center gap-2">
              <Switch
                id="smooth"
                checked={smooth}
                onCheckedChange={onSmoothChange}
              />
              <Label htmlFor="smooth" className="text-xs cursor-pointer">
                平滑曲线
              </Label>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch
              id="labels"
              checked={showLabels}
              onCheckedChange={onShowLabelsChange}
            />
            <Label htmlFor="labels" className="text-xs cursor-pointer">
              显示数值
            </Label>
          </div>
        </div>
      )}
    </div>
  );
}
