"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import GridLayout, { type Layout } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, ArrowLeft, LayoutDashboard, ZoomIn, ZoomOut } from "lucide-react";
import { DashboardWidgetCard } from "./dashboard-widget";
import { AddWidgetDialog } from "./add-widget-dialog";
import { AGGREGATION_OPTIONS, type ColumnMeta, type AggregationMode } from "@/components/charts/chart-utils";

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

interface DashboardData {
  id: string;
  name: string;
  widgets: WidgetData[];
}

interface DashboardEditorProps {
  schemaId: string;
  dashboardId: string;
}

const COLS = 12;
const ROW_HEIGHT = 200;

function toGridLayout(widgets: WidgetData[]): Layout {
  return widgets.map((w) => ({
    i: w.id,
    x: w.positionX,
    y: w.positionY,
    w: w.width,
    h: w.height,
    minW: 3,
    minH: 2,
  })) as Layout;
}

export function DashboardEditor({ schemaId, dashboardId }: DashboardEditorProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [deleteWidgetId, setDeleteWidgetId] = useState<string | null>(null);
  const [editWidgetId, setEditWidgetId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);

  const { data: dashboard, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard", dashboardId],
    queryFn: async () => {
      const res = await fetch(`/api/schemas/${schemaId}/dashboards/${dashboardId}`);
      if (!res.ok) throw new Error("加载失败");
      return res.json();
    },
  });

  // Save widget layout mutation
  const saveLayoutMutation = useMutation({
    mutationFn: async (widgets: { id: string; x: number; y: number; w: number; h: number }[]) => {
      await Promise.all(
        widgets.map((w) =>
          fetch(
            `/api/schemas/${schemaId}/dashboards/${dashboardId}/widgets/${w.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                positionX: w.x,
                positionY: w.y,
                width: w.w,
                height: w.h,
              }),
            }
          )
        )
      );
    },
  });

  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      if (dashboard?.widgets) {
        saveLayoutMutation.mutate(
          newLayout.map((l) => ({
            id: l.i,
            x: l.x,
            y: l.y,
            w: l.w,
            h: l.h,
          }))
        );
      }
    },
    [dashboard?.widgets, saveLayoutMutation]
  );

  // Add widget
  const addWidgetMutation = useMutation({
    mutationFn: async (data: {
      title?: string;
      tableId: string;
      chartType: string;
      config: Record<string, unknown>;
    }) => {
      const maxY = dashboard?.widgets?.length
        ? Math.max(...dashboard.widgets.map((w) => w.positionY)) + 1
        : 0;
      const res = await fetch(
        `/api/schemas/${schemaId}/dashboards/${dashboardId}/widgets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            positionX: 0,
            positionY: maxY,
            width: 6,
            height: 3,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "添加失败" }));
        throw new Error(err.error || "添加失败");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", dashboardId] });
      setShowAddWidget(false);
      toast.success("图表已添加");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "添加失败");
    },
  });

  // Delete widget
  const deleteWidgetMutation = useMutation({
    mutationFn: async (widgetId: string) => {
      const res = await fetch(
        `/api/schemas/${schemaId}/dashboards/${dashboardId}/widgets/${widgetId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("删除失败");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", dashboardId] });
      setDeleteWidgetId(null);
      toast.success("图表已删除");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "删除失败");
    },
  });

  // Edit widget config
  const editConfigMutation = useMutation({
    mutationFn: async ({
      widgetId,
      config,
    }: {
      widgetId: string;
      config: Record<string, unknown>;
    }) => {
      const res = await fetch(
        `/api/schemas/${schemaId}/dashboards/${dashboardId}/widgets/${widgetId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config }),
        }
      );
      if (!res.ok) throw new Error("保存失败");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", dashboardId] });
      setEditWidgetId(null);
      toast.success("配置已保存");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "保存失败");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <LayoutDashboard className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>看板不存在</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push(`/schemas/${schemaId}`)}>
          返回
        </Button>
      </div>
    );
  }

  const currentWidgets = dashboard.widgets || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/schemas/${schemaId}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
          <h2 className="text-xl font-bold">{dashboard.name}</h2>
          <span className="text-xs text-muted-foreground">
            {currentWidgets.length} 个图表
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 border rounded-md px-2 py-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setZoom((z) => Math.max(25, z - 10))}
              title="缩小"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-mono min-w-[40px] text-center select-none">
              {zoom}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
              title="放大"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button onClick={() => setShowAddWidget(true)}>
            <Plus className="h-4 w-4 mr-2" />
            添加图表
          </Button>
        </div>
      </div>

      {/* Grid wrapper with zoom */}
      {currentWidgets.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed rounded-lg">
          <LayoutDashboard className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          <p className="text-muted-foreground">尚未添加任何图表</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            点击上方按钮添加图表到看板
          </p>
        </div>
      ) : (
        <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
          <div
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top left",
              width: zoom > 100 ? `${(zoom / 100) * 100}%` : "100%",
            }}
          >
            <GridLayout
              className="layout"
              layout={toGridLayout(currentWidgets)}
              cols={COLS}
              rowHeight={ROW_HEIGHT}
              width={1200}
              onLayoutChange={handleLayoutChange}
              draggableHandle=".drag-handle"
              isResizable={true}
              compactType="vertical"
              margin={[16, 16]}
            >
              {currentWidgets.map((widget) => (
                <div key={widget.id} className="group">
                  <DashboardWidgetCard
                    widget={widget}
                    onEdit={() => setEditWidgetId(widget.id)}
                    onDelete={() => setDeleteWidgetId(widget.id)}
                    dragging={false}
                  />
                  {/* Drag handle overlay */}
                  <div className="drag-handle absolute top-0 left-0 right-8 h-6 cursor-grab active:cursor-grabbing z-10" />
                </div>
              ))}
            </GridLayout>
          </div>
        </div>
      )}

      {/* Add widget dialog */}
      <AddWidgetDialog
        open={showAddWidget}
        onOpenChange={setShowAddWidget}
        schemaId={schemaId}
        onConfirm={(data) =>
          addWidgetMutation.mutate({
            title: data.title,
            tableId: data.tableId,
            chartType: data.chartType,
            config: data.config,
          })
        }
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteWidgetId}
        onOpenChange={(open) => !open && setDeleteWidgetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除此图表吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteWidgetId(null)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteWidgetId && deleteWidgetMutation.mutate(deleteWidgetId)
              }
              className="bg-destructive hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit widget config dialog */}
      <EditWidgetConfigDialog
        widgetId={editWidgetId}
        dashboardId={dashboardId}
        schemaId={schemaId}
        onClose={() => setEditWidgetId(null)}
        onSave={(config) => {
          if (editWidgetId) {
            editConfigMutation.mutate({ widgetId: editWidgetId, config });
          }
        }}
      />
    </div>
  );
}

// ── Edit Widget Config Dialog ────────────────────────────────

function EditWidgetConfigDialog({
  widgetId,
  dashboardId,
  schemaId,
  onClose,
  onSave,
}: {
  widgetId: string | null;
  dashboardId: string;
  schemaId: string;
  onClose: () => void;
  onSave: (config: Record<string, unknown>) => void;
}) {
  const { data: widget } = useQuery<WidgetData>({
    queryKey: ["widget-config", dashboardId, widgetId],
    queryFn: async () => {
      if (!widgetId) return null;
      const res = await fetch(
        `/api/schemas/${schemaId}/dashboards/${dashboardId}`
      );
      const data = await res.json();
      return data.widgets?.find((w: WidgetData) => w.id === widgetId) || null;
    },
    enabled: !!widgetId,
  });

  const tableId = widget?.tableId;

  // Fetch table columns dynamically
  const { data: metadata } = useQuery({
    queryKey: ["table-meta", tableId],
    queryFn: () =>
      fetch(`/api/tables/${tableId}`).then((r) => r.json()),
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

  const config = (() => {
    try {
      return widget?.config ? JSON.parse(widget.config) : {};
    } catch {
      return {};
    }
  })();

  const [xAxis, setXAxis] = useState("");
  const [yAxes, setYAxes] = useState<string[]>([]);
  const [aggregation, setAggregation] = useState<AggregationMode>("none");

  useEffect(() => {
    if (widget) {
      const c = (() => { try { return JSON.parse(widget.config); } catch { return {}; } })();
      setXAxis(c.xAxis || "");
      setYAxes(c.yAxes || []);
      setAggregation(c.aggregation || "none");
    }
  }, [widget]);

  const toggleYAxis = (name: string) => {
    setYAxes((prev) =>
      prev.includes(name)
        ? prev.filter((y) => y !== name)
        : [...prev, name]
    );
  };

  const handleSave = () => {
    onSave({
      ...config,
      xAxis,
      yAxes,
      aggregation,
    });
  };

  const chartType = widget?.chartType || "bar";

  return (
    <Dialog open={!!widgetId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>配置图表</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* X-axis */}
          <div>
            <label className="text-xs text-muted-foreground font-medium">
              {chartType === "scatter" ? "X 轴 (数值)" : "X 轴 (分类)"}
            </label>
            <select
              className="w-full h-8 px-2 rounded border text-sm mt-1"
              value={xAxis}
              onChange={(e) => setXAxis(e.target.value)}
            >
              <option value="">选择字段...</option>
              {(chartType === "scatter" ? numericColumns : textColumns).map(
                (col) => (
                  <option key={col.physicalName} value={col.physicalName}>
                    {col.logicalName || col.physicalName}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Y-axes (multi-select) */}
          <div>
            <label className="text-xs text-muted-foreground font-medium">
              Y 轴 (数值，可多选)
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-[140px] overflow-y-auto border rounded-md p-2">
              {numericColumns.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  该表没有数值字段
                </span>
              )}
              {numericColumns.map((col) => {
                const name = col.physicalName;
                const label = col.logicalName || name;
                const checked = yAxes.includes(name);
                return (
                  <label
                    key={name}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs cursor-pointer transition-colors ${
                      checked
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "hover:bg-accent border border-transparent"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleYAxis(name)}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Aggregation chip group */}
          <div>
            <label className="text-xs text-muted-foreground font-medium">
              聚合方式
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {AGGREGATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAggregation(opt.value)}
                  className={`px-2.5 py-1 rounded text-xs cursor-pointer transition-colors border ${
                    aggregation === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-accent border-border text-muted-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
