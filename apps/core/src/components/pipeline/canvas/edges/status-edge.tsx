"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import { cn } from "@mizan/shared-lib/utils";

export function StatusEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as Record<string, unknown> | undefined;
  const status = edgeData?.status as string | undefined;
  const condition = edgeData?.condition as string | undefined;

  const colorMap: Record<string, string> = {
    COMPLETED: "!stroke-green-500",
    RUNNING: "!stroke-blue-400",
    FAILED: "!stroke-red-500",
  };

  const isRunning = status === "RUNNING";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className={cn(
          "!stroke-[2.5] transition-colors",
          selected ? "!stroke-blue-500" : colorMap[status || ""] || "!stroke-gray-400",
          isRunning && "[stroke-dasharray:8_4]"
        )}
        style={isRunning ? { animation: "flow-dash 0.8s linear infinite" } : undefined}
      />
      {condition && (
        <foreignObject
          width={120}
          height={20}
          x={(sourceX + targetX) / 2 - 60}
          y={(sourceY + targetY) / 2 - 10}
          className="overflow-visible"
        >
          <div className="bg-white border rounded px-1.5 py-0.5 text-[10px] text-gray-600 text-center shadow-sm">
            {condition}
          </div>
        </foreignObject>
      )}
    </>
  );
}
