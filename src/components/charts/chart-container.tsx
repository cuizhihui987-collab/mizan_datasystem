"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ComposedChart,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
  "#14b8a6",
  "#e11d48",
];

const chartTypes = [
  { value: "bar", label: "柱状图" },
  { value: "line", label: "折线图" },
  { value: "area", label: "面积图" },
  { value: "pie", label: "饼图" },
  { value: "scatter", label: "散点图" },
  { value: "combo", label: "组合图 (柱+线)" },
  { value: "radar", label: "雷达图" },
  { value: "heatmap", label: "热力图" },
] as const;

type ChartType = (typeof chartTypes)[number]["value"];

interface ColumnMeta {
  physicalName: string;
  logicalName: string;
  dataType: string;
}

interface ChartContainerProps {
  tableId: string;
}

export function ChartContainer({ tableId }: ChartContainerProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xAxis, setXAxis] = useState<string>("");
  const [yAxis, setYAxis] = useState<string>("");
  const [yAxis2, setYAxis2] = useState<string>(""); // for combo: line column
  const [colorGroup, setColorGroup] = useState<string>(""); // for scatter grouping

  const { data: metadata } = useQuery({
    queryKey: ["table-meta", tableId],
    queryFn: () => fetch(`/api/tables/${tableId}`).then((r) => r.json()),
  });

  const { data: tableData, isLoading } = useQuery({
    queryKey: ["table-data-all", tableId],
    queryFn: () =>
      fetch(`/api/tables/${tableId}/data?pageSize=500`).then((r) => r.json()),
    enabled: !!tableId,
  });

  const columns: ColumnMeta[] = metadata?.columns || [];
  const numericColumns = columns.filter((c) =>
    ["INTEGER", "BIGINT", "FLOAT", "DOUBLE", "DECIMAL"].includes(c.dataType)
  );
  const textColumns = columns.filter(
    (c) =>
      !["INTEGER", "BIGINT", "FLOAT", "DOUBLE", "DECIMAL"].includes(c.dataType)
  );
  // Auto-select fields
  useMemo(() => {
    if (!xAxis) {
      if (chartType === "scatter" && numericColumns.length > 0) {
        setXAxis(numericColumns[0].physicalName);
      } else if (textColumns.length > 0) {
        setXAxis(textColumns[0].physicalName);
      }
    }
    if (!yAxis && numericColumns.length > 0) {
      setYAxis(numericColumns[0].physicalName);
      if (numericColumns.length > 1) {
        setYAxis2(numericColumns[1].physicalName);
      }
    }
  }, [textColumns, numericColumns, chartType, xAxis, yAxis]);

  const chartData = useMemo(() => {
    if (!tableData?.rows) return [];
    // Use more data for scatter/heatmap, less for others
    const maxRows = ["scatter", "heatmap"].includes(chartType) ? 500 : 50;
    return tableData.rows.slice(0, maxRows);
  }, [tableData, chartType]);

  // --- Heatmap data preparation ---
  const heatmapData = useMemo(() => {
    if (chartType !== "heatmap" || !xAxis || !yAxis || !chartData.length) {
      return null;
    }

    const xKey = xAxis;
    const yKey = yAxis;
    const valKey = yAxis2 || numericColumns[0]?.physicalName;
    if (!valKey) return null;

    // Collect unique x and y values
    const xVals = new Set<string>();
    const yVals = new Set<string>();
    const grid: Record<string, Record<string, number>> = {};

    for (const row of chartData) {
      const xv = String(row[xKey] ?? "");
      const yv = String(row[yKey] ?? "");
      const vv = Number(row[valKey]) || 0;
      xVals.add(xv);
      yVals.add(yv);
      if (!grid[xv]) grid[xv] = {};
      grid[xv][yv] = (grid[xv][yv] || 0) + vv;
    }

    const xArr = Array.from(xVals).slice(0, 20);
    const yArr = Array.from(yVals).slice(0, 20);

    // Compute min/max for color scale
    let minVal = Infinity;
    let maxVal = -Infinity;
    for (const x of xArr) {
      for (const y of yArr) {
        const v = grid[x]?.[y] ?? 0;
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }
    const range = maxVal - minVal || 1;

    return { xArr, yArr, grid, minVal, range, valKey };
  }, [chartType, xAxis, yAxis, yAxis2, chartData, numericColumns]);

  // --- Scatter data with optional color grouping ---
  const scatterGroupedData = useMemo(() => {
    if (chartType !== "scatter" || !colorGroup) return null;
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of chartData) {
      const key = String(row[colorGroup] ?? "(空)");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    return Array.from(groups.entries()).map(([name, data], i) => ({
      name,
      data,
      fill: COLORS[i % COLORS.length],
    }));
  }, [chartType, colorGroup, chartData]);

  // --- Radar data preparation ---
  const radarColumns = useMemo(() => {
    if (chartType !== "radar") return [];
    // Use all numeric columns for radar
    return numericColumns.slice(0, 8);
  }, [chartType, numericColumns]);

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 30, left: 0, bottom: 0 } as const,
    };

    switch (chartType) {
      case "bar":
        if (!xAxis || !yAxis) return emptyHint;
        return (
          <ResponsiveContainer width="100%" height={500}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxis} tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={yAxis} fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        if (!xAxis || !yAxis) return emptyHint;
        return (
          <ResponsiveContainer width="100%" height={500}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxis} tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey={yAxis}
                stroke="#3b82f6"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case "area":
        if (!xAxis || !yAxis) return emptyHint;
        return (
          <ResponsiveContainer width="100%" height={500}>
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxis} tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey={yAxis}
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case "pie":
        if (!xAxis || !yAxis) return emptyHint;
        return (
          <ResponsiveContainer width="100%" height={500}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey={yAxis}
                nameKey={xAxis}
                cx="50%"
                cy="50%"
                outerRadius={180}
                label
              >
                {chartData.map((_: unknown, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      // --- Scatter Plot ---
      case "scatter": {
        if (!xAxis || !yAxis) return emptyHint;

        if (scatterGroupedData) {
          return (
            <ResponsiveContainer width="100%" height={500}>
              <ScatterChart {...commonProps}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey={xAxis}
                  type="number"
                  tick={{ fontSize: 12 }}
                  label={{
                    value: getLabel(xAxis),
                    position: "bottom",
                    offset: -5,
                  }}
                />
                <YAxis
                  dataKey={yAxis}
                  type="number"
                  label={{
                    value: getLabel(yAxis),
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip />
                <Legend />
                {scatterGroupedData.map((g) => (
                  <Scatter
                    key={g.name}
                    name={g.name}
                    data={g.data}
                    fill={g.fill}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          );
        }

        return (
          <ResponsiveContainer width="100%" height={500}>
            <ScatterChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={xAxis}
                type="number"
                tick={{ fontSize: 12 }}
                label={{ value: getLabel(xAxis), position: "bottom", offset: -5 }}
              />
              <YAxis
                dataKey={yAxis}
                type="number"
                label={{ value: getLabel(yAxis), angle: -90, position: "insideLeft" }}
              />
              <Tooltip />
              <Legend />
              <Scatter name={`${getLabel(xAxis)} vs ${getLabel(yAxis)}`} data={chartData} fill="#3b82f6" />
            </ScatterChart>
          </ResponsiveContainer>
        );
      }

      // --- Combo Chart (Bar + Line) ---
      case "combo": {
        if (!xAxis || !yAxis) return emptyHint;
        return (
          <ResponsiveContainer width="100%" height={500}>
            <ComposedChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxis} tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey={yAxis} fill="#3b82f6" name={getLabel(yAxis)} />
              {yAxis2 && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey={yAxis2}
                  stroke="#ef4444"
                  strokeWidth={2}
                  name={getLabel(yAxis2)}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        );
      }

      // --- Radar Chart ---
      case "radar": {
        if (radarColumns.length === 0 || !chartData.length) return emptyHint;

        // Build radar data: first 10 rows as items, all numeric columns as metrics
        const radarData = chartData.slice(0, 10).map((row: Record<string, unknown>) => {
          const item: Record<string, unknown> = { name: row[xAxis] || "—" };
          for (const col of radarColumns) {
            item[col.physicalName] = Number(row[col.physicalName]) || 0;
          }
          return item;
        });

        return (
          <ResponsiveContainer width="100%" height={500}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis />
              <Tooltip />
              <Legend />
              {radarColumns.map((col, idx) => (
                <Radar
                  key={col.physicalName}
                  name={col.logicalName}
                  dataKey={col.physicalName}
                  stroke={COLORS[idx % COLORS.length]}
                  fill={COLORS[idx % COLORS.length]}
                  fillOpacity={0.15}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        );
      }

      // --- Heatmap ---
      case "heatmap": {
        if (!heatmapData) return emptyHint;
        const { xArr, yArr, grid, minVal, range, valKey } = heatmapData;

        const cellW = Math.max(50, Math.min(100, 800 / xArr.length));
        const cellH = 30;
        const totalW = cellW * xArr.length + 100;
        const totalH = cellH * yArr.length + 60;

        const getColor = (v: number) => {
          const ratio = (v - minVal) / range;
          const r = Math.round(240 - ratio * 200);
          const g = Math.round(240 - ratio * 180);
          const b = Math.round(255 - ratio * 150);
          return `rgb(${r},${g},${b})`;
        };

        return (
          <div className="overflow-auto">
            <svg width={totalW} height={totalH}>
              {/* Column headers */}
              {xArr.map((x, i) => (
                <text
                  key={`ch-${i}`}
                  x={100 + cellW * i + cellW / 2}
                  y={14}
                  textAnchor="middle"
                  fontSize={10}
                  fill="currentColor"
                >
                  {truncateText(x, cellW / 7)}
                </text>
              ))}

              {/* Row headers + cells */}
              {yArr.map((y, ri) => (
                <g key={`row-${ri}`}>
                  <text
                    x={96}
                    y={40 + cellH * ri + cellH / 2 + 4}
                    textAnchor="end"
                    fontSize={10}
                    fill="currentColor"
                  >
                    {truncateText(y, 8)}
                  </text>
                  {xArr.map((x, ci) => {
                    const v = grid[x]?.[y] ?? 0;
                    return (
                      <g key={`c-${ri}-${ci}`}>
                        <rect
                          x={100 + cellW * ci}
                          y={30 + cellH * ri}
                          width={cellW - 1}
                          height={cellH - 1}
                          fill={getColor(v)}
                          rx={2}
                        />
                        <text
                          x={100 + cellW * ci + cellW / 2}
                          y={30 + cellH * ri + cellH / 2 + 4}
                          textAnchor="middle"
                          fontSize={10}
                          fill={v > minVal + range * 0.6 ? "#fff" : "#333"}
                        >
                          {formatNum(v)}
                        </text>
                      </g>
                    );
                  })}
                </g>
              ))}
            </svg>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>低</span>
              <div className="flex h-3 w-32 rounded overflow-hidden">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1"
                    style={{
                      backgroundColor: `rgb(${240 - i * 20},${240 - i * 18},${255 - i * 15})`,
                    }}
                  />
                ))}
              </div>
              <span>高</span>
              <span className="ml-2">
                值: {getLabel(valKey)}
              </span>
            </div>
          </div>
        );
      }

      default:
        return emptyHint;
    }
  };

  const emptyHint = (
    <div className="py-12 text-center text-muted-foreground">
      {chartType === "radar"
        ? "雷达图需要数值字段"
        : chartType === "heatmap"
          ? "请选择 X、Y 分类字段和数值字段"
          : "请选择 X 轴和 Y 轴字段"}
    </div>
  );

  // Update context-helpers
  const getLabel = (physicalName: string) =>
    columns.find((c) => c.physicalName === physicalName)?.logicalName ||
    physicalName;

  // --- Control panel: extra fields per chart type ---
  const renderExtraControls = () => {
    switch (chartType) {
      case "scatter":
        return (
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">颜色分组 (可选)</label>
            <Select value={colorGroup} onValueChange={(v) => setColorGroup(v === "_none" ? "" : v)}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="不分" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">不分</SelectItem>
                {textColumns.map((col) => (
                  <SelectItem key={col.physicalName} value={col.physicalName}>
                    {col.logicalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "combo":
        return (
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">折线轴 (右轴)</label>
            <Select value={yAxis2} onValueChange={setYAxis2}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="选择字段" />
              </SelectTrigger>
              <SelectContent>
                {numericColumns
                  .filter((c) => c.physicalName !== yAxis)
                  .map((col) => (
                    <SelectItem key={col.physicalName} value={col.physicalName}>
                      {col.logicalName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "heatmap":
        return (
          <>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Y 轴 (分类)</label>
              <Select value={yAxis} onValueChange={setYAxis}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="选择字段" />
                </SelectTrigger>
                <SelectContent>
                  {textColumns.map((col) => (
                    <SelectItem key={col.physicalName} value={col.physicalName}>
                      {col.logicalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">数值 (聚合)</label>
              <Select value={yAxis2} onValueChange={setYAxis2}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="选择字段" />
                </SelectTrigger>
                <SelectContent>
                  {numericColumns.map((col) => (
                    <SelectItem key={col.physicalName} value={col.physicalName}>
                      {col.logicalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        );

      case "radar":
        return null;

      default:
        return null;
    }
  };

  if (isLoading) {
    return <Skeleton className="h-[500px]" />;
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[120px] flex-1">
          <label className="text-xs text-muted-foreground">图表类型</label>
          <Select
            value={chartType}
            onValueChange={(v) => {
              setChartType(v as ChartType);
              setColorGroup("");
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {chartTypes.map((ct) => (
                <SelectItem key={ct.value} value={ct.value}>
                  {ct.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* X Axis */}
        {chartType !== "heatmap" && (
          <div className="min-w-[120px] flex-1">
            <label className="text-xs text-muted-foreground">
              {chartType === "scatter" ? "X 轴 (数值)" : "X 轴 (分类)"}
            </label>
            <Select value={xAxis} onValueChange={setXAxis}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="选择字段" />
              </SelectTrigger>
              <SelectContent>
                {chartType === "scatter"
                  ? numericColumns.map((col) => (
                      <SelectItem key={col.physicalName} value={col.physicalName}>
                        {col.logicalName}
                      </SelectItem>
                    ))
                  : textColumns.map((col) => (
                      <SelectItem key={col.physicalName} value={col.physicalName}>
                        {col.logicalName}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Y Axis (numeric) — hidden for heatmap which uses it as Y category */}
        {chartType !== "heatmap" && chartType !== "radar" && (
          <div className="min-w-[120px] flex-1">
            <label className="text-xs text-muted-foreground">
              {chartType === "scatter" ? "Y 轴 (数值)" : "Y 轴 (数值)"}
            </label>
            <Select value={yAxis} onValueChange={setYAxis}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="选择字段" />
              </SelectTrigger>
              <SelectContent>
                {numericColumns.map((col) => (
                  <SelectItem key={col.physicalName} value={col.physicalName}>
                    {col.logicalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Heatmap X axis */}
        {chartType === "heatmap" && (
          <div className="min-w-[120px] flex-1">
            <label className="text-xs text-muted-foreground">X 轴 (分类)</label>
            <Select value={xAxis} onValueChange={setXAxis}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="选择字段" />
              </SelectTrigger>
              <SelectContent>
                {textColumns.map((col) => (
                  <SelectItem key={col.physicalName} value={col.physicalName}>
                    {col.logicalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {renderExtraControls()}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {chartTypes.find((ct) => ct.value === chartType)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent>{renderChart()}</CardContent>
      </Card>
    </div>
  );
}

// --- Helpers ---

function truncateText(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function formatNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 10_000) return (n / 10_000).toFixed(1) + "万";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}
