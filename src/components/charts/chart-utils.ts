// ─── Chart utility helpers ───────────────────────────────

export const COLORS = [
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

export type AggregationMode = "none" | "sum" | "avg" | "count" | "min" | "max";

export interface ColumnMeta {
  physicalName: string;
  logicalName: string;
  dataType: string;
}

export interface ChartConfig {
  chartType: string;
  xAxis: string;
  yAxes: string[];
  yAxis2?: string;
  colorGroup?: string;
  aggregation?: AggregationMode;
  stacked?: boolean;
  showLabels?: boolean;
  smooth?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  title?: string;
}

export const CHART_TYPES = [
  { value: "bar", label: "柱状图" },
  { value: "line", label: "折线图" },
  { value: "area", label: "面积图" },
  { value: "pie", label: "饼图" },
  { value: "scatter", label: "散点图" },
  { value: "combo", label: "组合图 (柱+线)" },
  { value: "radar", label: "雷达图" },
  { value: "heatmap", label: "热力图" },
] as const;

export type ChartType = (typeof CHART_TYPES)[number]["value"];

export const AGGREGATION_OPTIONS: { value: AggregationMode; label: string }[] = [
  { value: "none", label: "逐行" },
  { value: "sum", label: "总和 (SUM)" },
  { value: "avg", label: "均值 (AVG)" },
  { value: "count", label: "计数 (COUNT)" },
  { value: "min", label: "最小值 (MIN)" },
  { value: "max", label: "最大值 (MAX)" },
];

export function truncateText(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export function formatNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 10_000) return (n / 10_000).toFixed(1) + "万";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

/** Aggregate data by xAxis field using the given mode */
export function aggregateData(
  rows: Record<string, unknown>[],
  xAxis: string,
  yAxes: string[],
  mode: AggregationMode
): Record<string, unknown>[] {
  if (mode === "none" || yAxes.length === 0) return rows;

  const groups = new Map<string, Record<string, number[]>>();

  for (const row of rows) {
    const key = String(row[xAxis] ?? "(空)");
    if (!groups.has(key)) groups.set(key, {});
    const group = groups.get(key)!;
    for (const y of yAxes) {
      const val = Number(row[y]) || 0;
      if (!group[y]) group[y] = [];
      group[y].push(val);
    }
  }

  const result: Record<string, unknown>[] = [];
  for (const [key, cols] of groups) {
    const row: Record<string, unknown> = { [xAxis]: key };
    for (const [col, vals] of Object.entries(cols)) {
      if (vals.length === 0) continue;
      switch (mode) {
        case "sum":
          row[col] = vals.reduce((a, b) => a + b, 0);
          break;
        case "avg":
          row[col] = vals.reduce((a, b) => a + b, 0) / vals.length;
          break;
        case "count":
          row[col] = vals.length;
          break;
        case "min":
          row[col] = Math.min(...vals);
          break;
        case "max":
          row[col] = Math.max(...vals);
          break;
      }
    }
    result.push(row);
  }

  return result;
}

/** Sort chart data by a field */
export function sortData(
  data: Record<string, unknown>[],
  sortBy: string,
  sortOrder: "asc" | "desc"
): Record<string, unknown>[] {
  if (!sortBy) return data;
  return [...data].sort((a, b) => {
    const va = Number(a[sortBy]) || 0;
    const vb = Number(b[sortBy]) || 0;
    return sortOrder === "asc" ? va - vb : vb - va;
  });
}

/** Download chart as PNG by cloning the SVG element */
export function downloadChartPNG(chartId: string, filename: string): void {
  const el = document.getElementById(chartId);
  if (!el) return;

  // Use the SVG directly — create a blob and download
  const svg = el.querySelector("svg");
  if (!svg) return;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  const blob = new Blob([svgStr], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download chart data as CSV */
export function downloadChartCSV(
  data: Record<string, unknown>[],
  filename: string
): void {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const v = row[h];
          if (v === null || v === undefined) return "";
          const s = String(v);
          return s.includes(",") ? `"${s}"` : s;
        })
        .join(",")
    ),
  ];
  const csv = csvRows.join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
