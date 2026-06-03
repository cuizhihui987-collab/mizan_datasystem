"use client";

import { useMemo } from "react";
import { DashboardWidgetCard } from "./dashboard-widget";

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

interface HomeDashboardLayoutProps {
  widgets: WidgetData[];
}

export function HomeDashboardLayout({ widgets }: HomeDashboardLayoutProps) {
  const rows = useMemo(() => {
    const map = new Map<number, WidgetData[]>();
    for (const w of widgets) {
      if (!map.has(w.positionY)) map.set(w.positionY, []);
      map.get(w.positionY)!.push(w);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [widgets]);

  return (
    <div className="space-y-4">
      {rows.map(([rowNum, rowWidgets]) => (
        <div key={rowNum} className="grid grid-cols-12 gap-4">
          {rowWidgets
            .sort((a, b) => a.positionX - b.positionX)
            .map((w) => (
              <div
                key={w.id}
                style={{
                  gridColumn: `${w.positionX + 1} / span ${Math.min(w.width, 12 - w.positionX)}`,
                  minHeight: `${Math.max(w.height * 100, 150)}px`,
                }}
              >
                <DashboardWidgetCard
                  widget={w}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              </div>
            ))}
        </div>
      ))}
      {rows.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <p>该看板还没有图表</p>
          <p className="text-sm mt-1">在编辑器中添加图表后将会显示在这里</p>
        </div>
      )}
    </div>
  );
}
