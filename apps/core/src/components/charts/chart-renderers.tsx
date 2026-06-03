"use client";

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
import { COLORS, type ColumnMeta } from "./chart-utils";

const CHART_MARGIN = { top: 10, right: 30, left: 0, bottom: 0 } as const;

interface RenderProps {
  chartType: string;
  data: Record<string, unknown>[];
  xAxis: string;
  yAxes: string[];
  yAxis2?: string;
  colorGroup?: string;
  stacked?: boolean;
  showLabels?: boolean;
  smooth?: boolean;
  columns: ColumnMeta[];
  numericColumns: ColumnMeta[];
  scatterGroupedData?: { name: string; data: Record<string, unknown>[]; fill: string }[] | null;
  radarColumns?: ColumnMeta[];
  heatmapData?: {
    xArr: string[];
    yArr: string[];
    grid: Record<string, Record<string, number>>;
    minVal: number;
    range: number;
    valKey: string;
  } | null;
  chartId: string;
}

function getLabel(columns: ColumnMeta[], physicalName: string): string {
  return columns.find((c) => c.physicalName === physicalName)?.logicalName || physicalName;
}

function renderBars(chartId: string, props: RenderProps) {
  const { data, xAxis, yAxes, stacked, showLabels, columns } = props;
  return (
    <ResponsiveContainer width="100%" height={500}>
      <BarChart data={data} margin={CHART_MARGIN} id={chartId}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xAxis} tick={{ fontSize: 12 }} />
        <YAxis />
        <Tooltip />
        <Legend />
        {yAxes.map((y, i) => (
          <Bar
            key={y}
            dataKey={y}
            name={getLabel(columns, y) || y}
            fill={COLORS[i % COLORS.length]}
            stackId={stacked ? "stack" : undefined}
            label={showLabels ? { position: "top", fontSize: 10 } : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function renderLines(chartId: string, props: RenderProps) {
  const { data, xAxis, yAxes, smooth, showLabels, columns } = props;
  return (
    <ResponsiveContainer width="100%" height={500}>
      <LineChart data={data} margin={CHART_MARGIN} id={chartId}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xAxis} tick={{ fontSize: 12 }} />
        <YAxis />
        <Tooltip />
        <Legend />
        {yAxes.map((y, i) => (
          <Line
            key={y}
            type={smooth ? "monotone" : "linear"}
            dataKey={y}
            name={getLabel(columns, y) || y}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={showLabels ? undefined : false}
            label={showLabels ? { position: "top", fontSize: 10 } : undefined}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function renderAreas(chartId: string, props: RenderProps) {
  const { data, xAxis, yAxes, stacked, smooth, showLabels, columns } = props;
  return (
    <ResponsiveContainer width="100%" height={500}>
      <AreaChart data={data} margin={CHART_MARGIN} id={chartId}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xAxis} tick={{ fontSize: 12 }} />
        <YAxis />
        <Tooltip />
        <Legend />
        {yAxes.map((y, i) => (
          <Area
            key={y}
            type={smooth ? "monotone" : "linear"}
            dataKey={y}
            name={getLabel(columns, y) || y}
            stroke={COLORS[i % COLORS.length]}
            fill={COLORS[i % COLORS.length]}
            fillOpacity={stacked ? 0.5 : 0.2}
            stackId={stacked ? "stack" : undefined}
            label={showLabels ? { position: "top", fontSize: 10 } : undefined}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function renderPie(chartId: string, props: RenderProps) {
  const { data, xAxis, yAxes, showLabels, columns } = props;
  return (
    <ResponsiveContainer width="100%" height={500}>
      <PieChart id={chartId}>
        <Pie
          data={data}
          dataKey={yAxes[0] || yAxes[0]}
          nameKey={xAxis}
          cx="50%"
          cy="50%"
          outerRadius={180}
          label={showLabels ? undefined : true}
        >
          {data.map((_: unknown, index: number) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

function renderScatter(chartId: string, props: RenderProps) {
  const { data, xAxis, yAxes, colorGroup, columns, scatterGroupedData } = props;
  const yAxis = yAxes[0] || yAxes[0];

  if (!xAxis || !yAxis) return null;

  if (scatterGroupedData) {
    return (
      <ResponsiveContainer width="100%" height={500}>
        <ScatterChart margin={CHART_MARGIN} id={chartId}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={xAxis}
            type="number"
            tick={{ fontSize: 12 }}
            label={{ value: getLabel(columns, xAxis), position: "bottom", offset: -5 }}
          />
          <YAxis
            dataKey={yAxis}
            type="number"
            label={{ value: getLabel(columns, yAxis), angle: -90, position: "insideLeft" }}
          />
          <Tooltip />
          <Legend />
          {scatterGroupedData.map((g) => (
            <Scatter key={g.name} name={g.name} data={g.data} fill={g.fill} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={500}>
      <ScatterChart margin={CHART_MARGIN} id={chartId}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xAxis} type="number" tick={{ fontSize: 12 }} label={{ value: getLabel(columns, xAxis), position: "bottom", offset: -5 }} />
        <YAxis dataKey={yAxis} type="number" label={{ value: getLabel(columns, yAxis), angle: -90, position: "insideLeft" }} />
        <Tooltip />
        <Legend />
        <Scatter name={`${getLabel(columns, xAxis)} vs ${getLabel(columns, yAxis)}`} data={data} fill="#3b82f6" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function renderCombo(chartId: string, props: RenderProps) {
  const { data, xAxis, yAxes, yAxis2, showLabels, columns } = props;
  if (!xAxis || yAxes.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={500}>
      <ComposedChart data={data} margin={CHART_MARGIN} id={chartId}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xAxis} tick={{ fontSize: 12 }} />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip />
        <Legend />
        {yAxes.map((y, i) => (
          <Bar
            key={y}
            yAxisId="left"
            dataKey={y}
            fill={COLORS[i % COLORS.length]}
            name={getLabel(columns, y) || y}
            label={showLabels ? { position: "top", fontSize: 10 } : undefined}
          />
        ))}
        {yAxis2 && (
          <Line
            yAxisId="right"
            type="monotone"
            dataKey={yAxis2}
            stroke="#ef4444"
            strokeWidth={2}
            name={getLabel(columns, yAxis2)}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function renderRadar(chartId: string, props: RenderProps) {
  const { data, xAxis, columns, radarColumns } = props;
  if (!radarColumns || radarColumns.length === 0 || !data.length) return null;

  const radarData = data.slice(0, 10).map((row: Record<string, unknown>) => {
    const item: Record<string, unknown> = { name: row[xAxis] || "—" };
    for (const col of radarColumns) {
      item[col.physicalName] = Number(row[col.physicalName]) || 0;
    }
    return item;
  });

  return (
    <ResponsiveContainer width="100%" height={500}>
      <RadarChart data={radarData} id={chartId}>
        <PolarGrid />
        <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
        <PolarRadiusAxis />
        <Tooltip />
        <Legend />
        {radarColumns.map((col, idx) => (
          <Radar
            key={col.physicalName}
            name={col.logicalName || col.physicalName}
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

function renderHeatmap(chartId: string, props: RenderProps) {
  const { heatmapData, columns } = props;
  if (!heatmapData) return null;
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
    <div className="overflow-auto" id={chartId}>
      <svg width={totalW} height={totalH}>
        {xArr.map((x, i) => (
          <text
            key={`ch-${i}`}
            x={100 + cellW * i + cellW / 2}
            y={14}
            textAnchor="middle"
            fontSize={10}
            fill="currentColor"
          >
            {x.length > Math.floor(cellW / 7) ? x.slice(0, Math.floor(cellW / 7)) + "…" : x}
          </text>
        ))}
        {yArr.map((y, ri) => (
          <g key={`row-${ri}`}>
            <text
              x={96}
              y={40 + cellH * ri + cellH / 2 + 4}
              textAnchor="end"
              fontSize={10}
              fill="currentColor"
            >
              {y.length > 8 ? y.slice(0, 8) + "…" : y}
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
                    {formatHeatmapNum(v)}
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
          值: {getLabel(columns, valKey)}
        </span>
      </div>
    </div>
  );
}

function formatHeatmapNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 10_000) return (n / 10_000).toFixed(1) + "万";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

/** Main chart renderer dispatcher */
export function renderChartByType(props: RenderProps): React.ReactNode {
  const { chartType } = props;

  if (chartType === "bar") return renderBars(props.chartId, props);
  if (chartType === "line") return renderLines(props.chartId, props);
  if (chartType === "area") return renderAreas(props.chartId, props);
  if (chartType === "pie") return renderPie(props.chartId, props);
  if (chartType === "scatter") return renderScatter(props.chartId, props);
  if (chartType === "combo") return renderCombo(props.chartId, props);
  if (chartType === "radar") return renderRadar(props.chartId, props);
  if (chartType === "heatmap") return renderHeatmap(props.chartId, props);

  return null;
}

export function getEmptyHint(chartType: string, yAxes: string[], xAxis: string, numericColumns: ColumnMeta[]): string {
  switch (chartType) {
    case "radar":
      return numericColumns.length === 0 ? "雷达图需要数值字段" : "请选择 X 轴分类字段";
    case "heatmap":
      return "请选择 X、Y 分类字段和数值字段";
    case "scatter":
      if (!xAxis) return "请选择 X 轴数值字段";
      if (yAxes.length === 0) return "请选择 Y 轴数值字段";
      return "请选择 X 轴和 Y 轴字段";
    default:
      if (!xAxis) return "请选择 X 轴分类字段";
      if (yAxes.length === 0) return "请选择 Y 轴数值字段";
      return "请选择 X 轴和 Y 轴字段";
  }
}

export function isChartReady(chartType: string, xAxis: string, yAxes: string[]): boolean {
  if (chartType === "heatmap") return !!(xAxis && yAxes.length > 0);
  if (!xAxis || yAxes.length === 0) return false;
  return true;
}
