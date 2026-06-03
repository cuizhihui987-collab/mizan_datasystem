"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings2, Trash2, AlertCircle } from "lucide-react";
import { renderChartByType, isChartReady, getEmptyHint } from "@/components/charts/chart-renderers";
import {
  aggregateData,
  sortData,
  type ColumnMeta,
  type AggregationMode,
} from "@/components/charts/chart-utils";
import { useMemo } from "react";

interface WidgetData {
  id: string;
  title: string | null;
  tableId: string | null;
  chartType: string;
  config: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
}

interface DashboardWidgetProps {
  widget: WidgetData;
  onEdit: () => void;
  onDelete: () => void;
  dragging?: boolean;
}

export function DashboardWidgetCard({
  widget,
  onEdit,
  onDelete,
  dragging,
}: DashboardWidgetProps) {
  const config = useMemo(() => {
    try {
      return JSON.parse(widget.config || "{}");
    } catch {
      return {};
    }
  }, [widget.config]);

  const chartType = widget.chartType || "bar";
  const xAxis: string = config.xAxis || "";
  const yAxes: string[] = config.yAxes || [];
  const aggregation: AggregationMode = config.aggregation || "none";
  const sortBy: string = config.sortBy || "_none";
  const sortOrder: "asc" | "desc" = config.sortOrder || "desc";

  const { data: metadata } = useQuery({
    queryKey: ["table-meta", widget.tableId],
    queryFn: () =>
      fetch(`/api/tables/${widget.tableId}`).then((r) => r.json()),
    enabled: !!widget.tableId,
  });

  const { data: tableData, isLoading } = useQuery({
    queryKey: ["table-data-all", widget.tableId],
    queryFn: () =>
      fetch(`/api/tables/${widget.tableId}/data?pageSize=500`).then((r) => r.json()),
    enabled: !!widget.tableId,
  });

  const columns: ColumnMeta[] = metadata?.columns || [];
  const numericColumns = columns.filter((c) =>
    ["INTEGER", "BIGINT", "FLOAT", "DOUBLE", "DECIMAL"].includes(c.dataType)
  );

  const processedData = useMemo(() => {
    if (!tableData?.rows) return [];
    let data = tableData.rows.slice(0, 200) as Record<string, unknown>[];
    if (aggregation !== "none" && xAxis && yAxes.length > 0) {
      data = aggregateData(data, xAxis, yAxes, aggregation);
    }
    if (sortBy && sortBy !== "_none") {
      data = sortData(data, sortBy, sortOrder);
    }
    return data;
  }, [tableData, xAxis, yAxes, aggregation, sortBy, sortOrder]);

  const chartReady = isChartReady(chartType, xAxis, yAxes);
  const emptyHint = getEmptyHint(chartType, yAxes, xAxis, numericColumns);

  return (
    <Card
      className={`h-full flex flex-col ${dragging ? "shadow-lg ring-2 ring-primary/30" : ""}`}
    >
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 space-y-0">
        <span className="text-sm font-medium truncate flex-1">
          {widget.title || `${chartType} 图表`}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onEdit}
          >
            <Settings2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 py-2 px-3">
        {!widget.tableId ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            未选择数据表
          </div>
        ) : isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : !chartReady ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            {emptyHint}
          </div>
        ) : processedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-xs text-muted-foreground">
            <AlertCircle className="h-5 w-5 mb-1 opacity-50" />
            无数据
          </div>
        ) : (
          <div className="h-full w-full" style={{ minHeight: 0 }}>
            {renderChartByType({
              chartType,
              data: processedData,
              xAxis,
              yAxes,
              columns,
              numericColumns,
              chartId: `widget-chart-${widget.id}`,
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
