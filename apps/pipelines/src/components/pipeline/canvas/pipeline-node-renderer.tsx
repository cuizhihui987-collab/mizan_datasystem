"use client";

import { PipelineNodeWrapper } from "./pipeline-node-wrapper";
import type { PipelineNodeData } from "@/lib/pipeline/pipeline-converter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PipelineNodeRenderer({ data, selected }: any) {
  const nodeData = data as unknown as PipelineNodeData;
  return (
    <PipelineNodeWrapper data={nodeData} selected={selected ?? false}>
      <NodeBody data={nodeData} />
    </PipelineNodeWrapper>
  );
}

/** 根据 stepType 渲染节点 body 摘要和端口 */
function NodeBody({ data }: { data: PipelineNodeData }) {
  const cfg = data.config;

  switch (data.stepType) {
    case "source_table":
      return (
        <div className="space-y-1">
          <p className="font-medium text-gray-700">源数据表</p>
          <p className="text-gray-500 truncate">{String(cfg.sourceTableId || "未选择")}</p>
        </div>
      );

    case "source_import":
      return (
        <div className="space-y-1">
          <p className="font-medium text-gray-700">导入文件</p>
          {cfg.fileId ? (
            <p className="text-gray-500 truncate">文件 ID: {String(cfg.fileId)}</p>
          ) : (
            <p className="text-gray-400">未选择文件</p>
          )}
        </div>
      );

    case "source_api":
      return (
        <div className="space-y-1">
          <p className="font-medium text-gray-700">外部 API</p>
          <p className="text-gray-500 truncate text-[11px]">
            {String(cfg.endpoint || "未配置")}
          </p>
        </div>
      );

    case "transform_sql":
      return (
        <div className="space-y-1">
          <p className="font-medium text-gray-700">SQL 转换</p>
          <code className="block text-[10px] text-gray-500 truncate bg-gray-50 rounded px-1 py-0.5">
            {cfg.sql ? String(cfg.sql).slice(0, 60) : "空查询"}
          </code>
        </div>
      );

    case "transform_merge":
      return (
        <div className="space-y-1">
          <p className="font-medium text-gray-700">
            {(cfg as Record<string, string>).joinType || "INNER"} JOIN
          </p>
          <p className="text-gray-500 truncate text-[11px]">
            {cfg.leftOn ? `${String(cfg.leftOn)} = ${String(cfg.rightOn || "?")}` : "未配置关联字段"}
          </p>
        </div>
      );

    case "transform_filter":
      return (
        <div className="space-y-1">
          <p className="font-medium text-gray-700">筛选数据</p>
          <p className="text-gray-500">
            {(cfg.filters as { conditions?: unknown[] })?.conditions?.length || 0} 个条件
          </p>
        </div>
      );

    case "transform_aggregate":
      return (
        <div className="space-y-1">
          <p className="font-medium text-gray-700">聚合计算</p>
          <p className="text-gray-500 truncate text-[11px]">
            {String(cfg.groupBy || "") ? `分组: ${String(cfg.groupBy)}` : "未配置"}
          </p>
        </div>
      );

    case "transform_deduplicate":
      return (
        <div className="space-y-1">
          <p className="font-medium text-gray-700">去重</p>
          <p className="text-gray-500">
            {String(cfg.keys || "") ? `依据: ${String(cfg.keys)}` : "按所有列去重"}
          </p>
        </div>
      );

    case "output_table":
      return (
        <div className="space-y-1">
          <p className="font-medium text-gray-700">输出到表</p>
          <p className="text-gray-500 truncate">
            {cfg.tableName ? String(cfg.tableName) : "未命名"}
          </p>
          {Boolean(cfg.overwriteIfExists) && (
            <p className="text-amber-600 text-[10px]">覆盖已存在表</p>
          )}
        </div>
      );

    case "flow_branch":
    case "flow_switch":
      return (
        <div className="space-y-1">
          <p className="font-medium text-gray-700">
            {data.stepType === "flow_branch" ? "条件分支" : "多路分支"}
          </p>
          <p className="text-gray-500">
            {String(cfg.condition || "") ? String(cfg.condition) : "点击配置条件"}
          </p>
        </div>
      );

    case "flow_parallel":
      return (
        <div className="space-y-1">
          <p className="font-medium text-gray-700">并行分发</p>
          <p className="text-gray-500">数据同时下发到多条路径</p>
        </div>
      );

    case "flow_merge_all":
      return (
        <div className="space-y-1">
          <p className="font-medium text-gray-700">合并流</p>
          <p className="text-gray-500">UNION ALL 合并多条输入</p>
        </div>
      );

    case "flow_loop":
      return (
        <div className="space-y-1">
          <p className="font-medium text-gray-700">循环</p>
          <p className="text-gray-500">{String(cfg.times || "") ? `重复 ${String(cfg.times)} 次` : "点击配置"}</p>
        </div>
      );

    default:
      return <p className="text-gray-400">{data.summary}</p>;
  }
}
