"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Download, RotateCcw, FileDown } from "lucide-react";
import { ChartControls } from "./chart-controls";
import { renderChartByType, getEmptyHint, isChartReady } from "./chart-renderers";
import {
  aggregateData,
  sortData,
  downloadChartPNG,
  downloadChartCSV,
  COLORS,
  type ColumnMeta,
  type ChartType,
  type AggregationMode,
} from "./chart-utils";

const CHART_ID = "chart-render-area";

interface ChartContainerProps {
  tableId: string;
}

export function ChartContainer({ tableId }: ChartContainerProps) {
  // ── Chart config state ──
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xAxis, setXAxis] = useState<string>("");
  const [yAxes, setYAxes] = useState<string[]>([]);
  const [yAxis2, setYAxis2] = useState<string>("");
  const [colorGroup, setColorGroup] = useState<string>("");
  const [aggregation, setAggregation] = useState<AggregationMode>("none");
  const [stacked, setStacked] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [smooth, setSmooth] = useState(false);
  const [sortBy, setSortBy] = useState<string>("_none");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [chartTitle, setChartTitle] = useState("");

  // ── Data fetching ──
  const {
    data: metadata,
    error: metaError,
    refetch: refetchMeta,
  } = useQuery({
    queryKey: ["table-meta", tableId],
    queryFn: () => fetch(`/api/tables/${tableId}`).then((r) => r.json()),
  });

  const {
    data: tableData,
    isLoading,
    error: dataError,
    refetch: refetchData,
  } = useQuery({
    queryKey: ["table-data-all", tableId],
    queryFn: () =>
      fetch(`/api/tables/${tableId}/data?pageSize=500`).then((r) => r.json()),
    enabled: !!tableId,
  });

  // ── Derived ──
  const columns: ColumnMeta[] = metadata?.columns || [];
  const tableName: string = metadata?.logicalName || metadata?.physicalName || "";

  const numericColumns = useMemo(
    () =>
      columns.filter((c) =>
        ["INTEGER", "BIGINT", "FLOAT", "DOUBLE", "DECIMAL"].includes(c.dataType)
      ),
    [columns]
  );

  const textColumns = useMemo(
    () =>
      columns.filter(
        (c) =>
          !["INTEGER", "BIGINT", "FLOAT", "DOUBLE", "DECIMAL"].includes(c.dataType)
      ),
    [columns]
  );

  // Auto-select fields on first load
  useEffect(() => {
    if (metadata && !xAxis && !yAxes.length) {
      if (chartType === "scatter" && numericColumns.length > 0) {
        setXAxis(numericColumns[0].physicalName);
      } else if (textColumns.length > 0) {
        setXAxis(textColumns[0].physicalName);
      }
      if (numericColumns.length > 0) {
        setYAxes([numericColumns[0].physicalName]);
        if (numericColumns.length > 1) {
          setYAxis2(numericColumns[1].physicalName);
        }
      }
    }
  }, [metadata, chartType]);

  // Set chart title from table name
  useEffect(() => {
    if (tableName && !chartTitle) {
      setChartTitle(tableName);
    }
  }, [tableName]);

  // ── Data processing pipeline ──
  const processedData = useMemo(() => {
    if (!tableData?.rows) return [];

    const maxRows = ["scatter", "heatmap"].includes(chartType) ? 500 : 200;
    let data = tableData.rows.slice(0, maxRows) as Record<string, unknown>[];

    // 1. Aggregate
    if (aggregation !== "none" && xAxis && yAxes.length > 0) {
      data = aggregateData(data, xAxis, yAxes, aggregation);
    }

    // 2. Sort
    if (sortBy && sortBy !== "_none") {
      data = sortData(data, sortBy, sortOrder);
    }

    return data;
  }, [tableData, chartType, xAxis, yAxes, aggregation, sortBy, sortOrder]);

  // ── Specialized data for radar / scatter group / heatmap ──
  const scatterGroupedData = useMemo(() => {
    if (chartType !== "scatter" || !colorGroup) return null;
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of processedData) {
      const key = String(row[colorGroup] ?? "(空)");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    return Array.from(groups.entries()).map(([name, data], i) => ({
      name,
      data,
      fill: COLORS[i % COLORS.length],
    }));
  }, [chartType, colorGroup, processedData]);

  const radarColumnDefs = useMemo(() => {
    if (chartType !== "radar") return [];
    return numericColumns.slice(0, 8);
  }, [chartType, numericColumns]);

  const heatmapData = useMemo(() => {
    if (chartType !== "heatmap" || !xAxis || !yAxis2 || !processedData.length) return null;

    const valKey = yAxes[0] || numericColumns[0]?.physicalName;
    if (!valKey) return null;

    const xVals = new Set<string>();
    const yVals = new Set<string>();
    const grid: Record<string, Record<string, number>> = {};

    for (const row of processedData) {
      const xv = String(row[xAxis] ?? "");
      const yv = String(row[yAxis2] ?? "");
      const vv = Number(row[valKey]) || 0;
      xVals.add(xv);
      yVals.add(yv);
      if (!grid[xv]) grid[xv] = {};
      grid[xv][yv] = (grid[xv][yv] || 0) + vv;
    }

    const xArr = Array.from(xVals).slice(0, 20);
    const yArr = Array.from(yVals).slice(0, 20);

    let minVal = Infinity;
    let maxVal = -Infinity;
    for (const x of xArr) {
      for (const y of yArr) {
        const v = grid[x]?.[y] ?? 0;
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }

    return { xArr, yArr, grid, minVal, range: maxVal - minVal || 1, valKey };
  }, [chartType, xAxis, yAxis2, yAxes, processedData, numericColumns]);

  const chartReady = isChartReady(chartType, xAxis, yAxes);
  const emptyHint = getEmptyHint(chartType, yAxes, xAxis, numericColumns);

  // ── Export handlers ──
  const handleExportSVG = () => {
    downloadChartPNG(CHART_ID, `${chartTitle || "chart"}`);
  };

  const handleExportCSV = () => {
    downloadChartCSV(processedData, `${chartTitle || "chart"}`);
  };

  // ── Error state ──
  const error = metaError || dataError;
  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
            <p className="text-muted-foreground">数据加载失败</p>
            <p className="text-sm text-muted-foreground/60">
              {(error as Error)?.message || "请稍后重试"}
            </p>
            <Button variant="outline" size="sm" onClick={() => { refetchMeta(); refetchData(); }}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="pt-4">
          <ChartControls
            chartType={chartType}
            onChartTypeChange={(v) => { setChartType(v); setColorGroup(""); }}
            xAxis={xAxis}
            onXAxisChange={setXAxis}
            yAxes={yAxes}
            onYAxesChange={setYAxes}
            yAxis2={yAxis2}
            onYAxis2Change={setYAxis2}
            colorGroup={colorGroup}
            onColorGroupChange={setColorGroup}
            aggregation={aggregation}
            onAggregationChange={setAggregation}
            stacked={stacked}
            onStackedChange={setStacked}
            showLabels={showLabels}
            onShowLabelsChange={setShowLabels}
            smooth={smooth}
            onSmoothChange={setSmooth}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            textColumns={textColumns}
            numericColumns={numericColumns}
          />
        </CardContent>
      </Card>

      {/* Chart Display */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Input
              value={chartTitle}
              onChange={(e) => setChartTitle(e.target.value)}
              className="h-7 text-base font-semibold w-auto min-w-[120px] max-w-[300px] border-none px-0 hover:border focus:border focus:px-2"
            />
            {chartType && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {chartType === "bar" ? "柱状图" : chartType === "line" ? "折线图" : chartType === "area" ? "面积图" : chartType === "pie" ? "饼图" : chartType === "scatter" ? "散点图" : chartType === "combo" ? "组合图" : chartType === "radar" ? "雷达图" : "热力图"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {processedData.length > 0 && (
              <>
                <span className="text-xs text-muted-foreground mr-2">
                  {processedData.length} 行
                </span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleExportSVG}>
                  <Download className="h-3 w-3 mr-1" />
                  SVG
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleExportCSV}>
                  <FileDown className="h-3 w-3 mr-1" />
                  CSV
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!chartReady ? (
            <div className="py-16 text-center text-muted-foreground">
              {emptyHint}
            </div>
          ) : processedData.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>所选条件下没有数据</p>
              <p className="text-sm mt-1">尝试调整筛选字段或聚合方式</p>
            </div>
          ) : (
            <div id={CHART_ID}>
              {renderChartByType({
                chartType,
                data: processedData,
                xAxis,
                yAxes,
                yAxis2,
                colorGroup,
                stacked,
                showLabels,
                smooth,
                columns,
                numericColumns,
                scatterGroupedData,
                radarColumns: radarColumnDefs,
                heatmapData,
                chartId: CHART_ID,
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
