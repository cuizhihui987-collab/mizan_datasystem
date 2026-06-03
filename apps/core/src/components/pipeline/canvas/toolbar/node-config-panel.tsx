"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Trash2, ExternalLink } from "lucide-react";
import type { PipelineNodeData } from "@/lib/pipeline/pipeline-converter";

interface Props {
  node: PipelineNodeData | null;
  onOpenConfig: () => void;
  onDelete: () => void;
  onLabelChange: (label: string) => void;
}

export function NodeConfigPanel({
  node,
  onOpenConfig,
  onDelete,
  onLabelChange,
}: Props) {
  if (!node) {
    return (
      <div className="w-56 border-l bg-white flex items-center justify-center text-xs text-gray-400 p-4">
        <p className="text-center">选择一个节点查看配置</p>
      </div>
    );
  }

  return (
    <div className="w-56 border-l bg-white flex flex-col">
      <div className="p-3 border-b">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">节点配置</h4>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div>
          <Label className="text-[11px]">名称</Label>
          <Input
            value={node.label}
            onChange={(e) => onLabelChange(e.target.value)}
            className="h-7 text-xs mt-1"
          />
        </div>

        <div>
          <Label className="text-[11px]">类型</Label>
          <p className="text-xs text-gray-600 mt-1">{node.stepType}</p>
        </div>

        <div>
          <Label className="text-[11px]">状态</Label>
          <p className="text-xs text-gray-600 mt-1">{node.status || "PENDING"}</p>
        </div>

        {node.summary && (
          <div>
            <Label className="text-[11px]">摘要</Label>
            <p className="text-xs text-gray-500 mt-1">{node.summary}</p>
          </div>
        )}
      </div>

      <div className="p-3 border-t space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs gap-1.5"
          onClick={onOpenConfig}
        >
          <Settings className="h-3 w-3" />
          详细配置
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
          删除节点
        </Button>
      </div>
    </div>
  );
}
