"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import { cn } from "@mizan/shared-lib/utils";

export function AnimatedEdge({
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
  const condition = edgeData?.condition as string | undefined;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className={cn(
          "!stroke-[2.5]",
          selected ? "!stroke-blue-500" : "!stroke-gray-400",
          "[stroke-dasharray:8_4]"
        )}
        style={{
          animation: "flow-dash 0.8s linear infinite",
        }}
      />
      {condition && (
        <foreignObject
          width={120}
          height={20}
          x={(sourceX + targetX) / 2 - 60}
          y={(sourceY + targetY) / 2 - 10}
          className="overflow-visible"
        >
          <div className="bg-white border rounded px-1.5 py-0.5 text-[10px] text-gray-600 text-center shadow-sm whitespace-nowrap">
            {condition}
          </div>
        </foreignObject>
      )}
    </>
  );
}
