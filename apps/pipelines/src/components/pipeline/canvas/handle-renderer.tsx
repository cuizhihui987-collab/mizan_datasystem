"use client";

import { Handle, Position, type HandleType } from "@xyflow/react";
import { cn } from "@mizan/shared-lib/utils";
import type { StepGroup } from "@/lib/pipeline/dag-utils";

interface HandleDef {
  id: string;
  label?: string;
  type: HandleType;
  position: Position;
}

interface Props {
  handles: HandleDef[];
  group: StepGroup;
  isConnectable?: boolean;
}

const COLORS: Record<StepGroup, string> = {
  source: "#3B82F6",
  transform: "#F59E0B",
  output: "#22C55E",
  flow: "#A855F7",
};

export function HandleRenderer({ handles, group, isConnectable = true }: Props) {
  const color = COLORS[group] || "#6B7280";

  return (
    <>
      {handles.map((h) => (
        <Handle
          key={h.id}
          type={h.type}
          position={h.position}
          id={h.id}
          isConnectable={isConnectable}
          className={cn(
            "!w-3 !h-3 !border-2 !border-white transition-transform hover:!scale-150",
            h.type === "source" ? "!-right-1.5" : "!-left-1.5"
          )}
          style={{ backgroundColor: color }}
        />
      ))}
    </>
  );
}
