"use client";

import { Button } from "@/components/ui/button";
import { Save, Play, ZoomIn, ZoomOut, Maximize2, LayoutGrid, List } from "lucide-react";

interface Props {
  pipelineName: string;
  zoom: number;
  isDirty: boolean;
  isExecuting: boolean;
  viewMode: "canvas" | "list";
  onSave: () => void;
  onExecute: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onToggleView: () => void;
}

export function CanvasToolbar({
  pipelineName,
  zoom,
  isDirty,
  isExecuting,
  viewMode,
  onSave,
  onExecute,
  onZoomIn,
  onZoomOut,
  onFitView,
  onToggleView,
}: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b rounded-t-xl">
      {/* Left */}
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-gray-800 truncate max-w-[200px]">
          {pipelineName}
        </h3>
        {isDirty && (
          <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
            未保存
          </span>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5">
        {/* Zoom */}
        <div className="flex items-center gap-0.5 mr-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomOut} title="缩小">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-[11px] text-gray-500 w-10 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomIn} title="放大">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onFitView} title="适应画布">
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onToggleView}
          title={viewMode === "canvas" ? "列表视图" : "画布视图"}
        >
          {viewMode === "canvas" ? <List className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
        </Button>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onSave}
          disabled={!isDirty}
        >
          <Save className="h-3.5 w-3.5" />
          保存
        </Button>

        <Button
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onExecute}
          disabled={isExecuting}
        >
          <Play className="h-3.5 w-3.5" />
          {isExecuting ? "执行中..." : "执行"}
        </Button>
      </div>
    </div>
  );
}
