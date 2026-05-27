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
];

type ChartType = "bar" | "line" | "pie" | "area";

interface ChartContainerProps {
  tableId: string;
}

export function ChartContainer({ tableId }: ChartContainerProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xAxis, setXAxis] = useState<string>("");
  const [yAxis, setYAxis] = useState<string>("");

  const { data: metadata } = useQuery({
    queryKey: ["table-meta", tableId],
    queryFn: () => fetch(`/api/tables/${tableId}`).then((r) => r.json()),
  });

  const { data: tableData, isLoading } = useQuery({
    queryKey: ["table-data-all", tableId],
    queryFn: () =>
      fetch(`/api/tables/${tableId}/data?pageSize=200`).then((r) =>
        r.json()
      ),
    enabled: !!tableId,
  });

  const columns = metadata?.columns || [];
  const numericColumns = columns.filter(
    (c: { dataType: string; logicalName: string; physicalName: string }) =>
      ["INTEGER", "BIGINT", "FLOAT", "DOUBLE"].includes(c.dataType)
  );
  const textColumns = columns.filter(
    (c: { dataType: string }) => !["INTEGER", "BIGINT", "FLOAT", "DOUBLE"].includes(c.dataType)
  );

  // Auto-select first category and first numeric column
  useMemo(() => {
    if (!xAxis && textColumns.length > 0) {
      setXAxis(textColumns[0].physicalName);
    }
    if (!yAxis && numericColumns.length > 0) {
      setYAxis(numericColumns[0].physicalName);
    }
  }, [textColumns, numericColumns, xAxis, yAxis]);

  const chartData = useMemo(() => {
    if (!tableData?.rows) return [];
    return tableData.rows.slice(0, 50);
  }, [tableData]);

  const renderChart = () => {
    if (!xAxis || !yAxis) {
      return (
        <div className="py-12 text-center text-muted-foreground">
          请选择 X 轴和 Y 轴字段
        </div>
      );
    }

    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
    };

    switch (chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={400}>
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
        return (
          <ResponsiveContainer width="100%" height={400}>
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
        return (
          <ResponsiveContainer width="100%" height={400}>
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
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey={yAxis}
                nameKey={xAxis}
                cx="50%"
                cy="50%"
                outerRadius={150}
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
    }
  };

  if (isLoading) {
    return <Skeleton className="h-[500px]" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">图表类型</label>
          <Select
            value={chartType}
            onValueChange={(v) => setChartType(v as ChartType)}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bar">柱状图</SelectItem>
              <SelectItem value="line">折线图</SelectItem>
              <SelectItem value="area">面积图</SelectItem>
              <SelectItem value="pie">饼图</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">X 轴 (分类)</label>
          <Select value={xAxis} onValueChange={setXAxis}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="选择字段" />
            </SelectTrigger>
            <SelectContent>
              {textColumns.map(
                (col: {
                  physicalName: string;
                  logicalName: string;
                }) => (
                  <SelectItem key={col.physicalName} value={col.physicalName}>
                    {col.logicalName}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">Y 轴 (数值)</label>
          <Select value={yAxis} onValueChange={setYAxis}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="选择字段" />
            </SelectTrigger>
            <SelectContent>
              {numericColumns.map(
                (col: {
                  physicalName: string;
                  logicalName: string;
                }) => (
                  <SelectItem key={col.physicalName} value={col.physicalName}>
                    {col.logicalName}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {chartType === "bar" && "柱状图"}
            {chartType === "line" && "折线图"}
            {chartType === "area" && "面积图"}
            {chartType === "pie" && "饼图"}
          </CardTitle>
        </CardHeader>
        <CardContent>{renderChart()}</CardContent>
      </Card>
    </div>
  );
}
