import type { Node, Edge, XYPosition } from "@xyflow/react";
import type { PipelineFlowEdge } from "./dag-utils";

// ─── 数据库模型类型 ──────────────────────────────────────

export interface PipelineStep {
  id: string;
  stepOrder: number;
  stepType: string;
  label: string | null;
  config: string; // JSON string
  sourceTableId: string | null;
  outputPhysicalName: string;
  status: string;
  errorLog: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineDefinition {
  id: string;
  schemaId: string;
  name: string;
  description: string | null;
  status: string;
  edges: string; // JSON string
  createdAt: string;
  updatedAt: string;
  steps: PipelineStep[];
}

// ─── ReactFlow 数据类型 ─────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PipelineNodeData extends Record<string, unknown> {
  stepType: string;
  label: string;
  status: string;
  stepId: string;
  config: Record<string, unknown>;
  /** 步骤摘要文本（显示在节点 body 中） */
  summary: string;
  /** 步骤分组 */
  group: "source" | "transform" | "output" | "flow";
  /** 右键菜单回调 (不序列化, 仅运行时) */
  onEdit?: () => void;
  onDelete?: () => void;
}

export type PipelineFlowNode = Node<PipelineNodeData>;

// ─── 节点默认尺寸 ────────────────────────────────────────

export const NODE_WIDTH = 240;
export const NODE_MIN_HEIGHT = 80;

// ─── 颜色映射 ────────────────────────────────────────────

export const STEP_GROUP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  source: { bg: "#3B82F6", border: "#93C5FD", text: "#FFFFFF" },
  transform: { bg: "#F59E0B", border: "#FCD34D", text: "#FFFFFF" },
  output: { bg: "#22C55E", border: "#86EFAC", text: "#FFFFFF" },
  flow: { bg: "#A855F7", border: "#C4B5FD", text: "#FFFFFF" },
};

// ─── 步骤类型 → 摘要文本 ─────────────────────────────────

function getStepSummary(stepType: string, config: Record<string, unknown>): string {
  switch (stepType) {
    case "source_table":
      return `源表: ${config.sourceTableId || "未选择"}`;
    case "source_import":
      return `文件: ${config.fileId || "未选择"}`;
    case "source_api":
      return `API: ${config.endpoint || "未配置"}`;
    case "transform_sql":
      return `SQL 转换`;
    case "transform_merge":
      return `合并: ${(config as Record<string, string>).joinType || "INNER"}`;
    case "transform_filter":
      return `筛选: ${((config.filters as { conditions?: unknown[] })?.conditions || []).length} 个条件`;
    case "transform_aggregate":
      return `聚合计算`;
    case "transform_pivot":
      return `行列转置`;
    case "transform_deduplicate":
      return `去重`;
    case "transform_sort":
      return `排序`;
    case "transform_union":
      return `UNION 合并`;
    case "transform_custom_script":
      return `自定义脚本`;
    case "output_table":
      return `输出到表: ${config.tableName || "未命名"}`;
    case "output_api":
      return `推送 API`;
    case "output_file":
      return `导出文件`;
    case "output_notification":
      return `发送通知`;
    case "flow_branch":
      return `条件分支`;
    case "flow_switch":
      return `多路分支`;
    case "flow_parallel":
      return `并行分发`;
    case "flow_loop":
      return `循环`;
    case "flow_merge_all":
      return `合并流`;
    case "source_database":
      return `外部数据库`;
    case "source_stream":
      return `流式数据`;
    case "source_webhook":
      return `Webhook`;
    default:
      return stepType;
  }
}

// ─── 步骤 → ReactFlow 节点 ──────────────────────────────

export function stepToNode(step: PipelineStep): PipelineFlowNode {
  const config = JSON.parse(step.config || "{}");
  const position: XYPosition = (config as Record<string, unknown>)._nodePosition as XYPosition || { x: 0, y: 0 };

  return {
    id: step.id,
    type: "pipelineNode",
    position,
    data: {
      stepType: step.stepType,
      label: step.label || step.stepType,
      status: step.status,
      stepId: step.id,
      config,
      summary: getStepSummary(step.stepType, config),
      group: getStepGroupFromType(step.stepType),
    },
    deletable: true,
    selected: false,
  };
}

export function stepsToNodes(steps: PipelineStep[]): PipelineFlowNode[] {
  return steps.map(stepToNode);
}

// ─── edges JSON ⇄ ReactFlow Edges ───────────────────────

export function edgesToFlowEdges(edgesJson: string): PipelineFlowEdge[] {
  try {
    const edges = JSON.parse(edgesJson || "[]") as PipelineFlowEdge[];
    return edges.map((e, i) => ({
      ...e,
      id: e.id || `loaded-edge-${i}-${Date.now()}`,
    }));
  } catch {
    return [];
  }
}

export function flowEdgesToJson(edges: PipelineFlowEdge[]): string {
  return JSON.stringify(edges);
}

// ─── 旧 pipeline 兼容: 从 stepOrder 生成线性边 ──────────

export function generateLinearEdges(steps: PipelineStep[]): PipelineFlowEdge[] {
  const edges: PipelineFlowEdge[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    edges.push({
      id: `edge-auto-${steps[i].id}-${steps[i + 1].id}`,
      source: steps[i].id,
      target: steps[i + 1].id,
      sourceHandle: "output",
      targetHandle: "input",
      type: "animated",
      animated: true,
    });
  }
  return edges;
}

// ─── 生成默认步骤标签 ────────────────────────────────────

const STEP_LABEL_MAP: Record<string, string> = {
  source_table: "数据表",
  source_import: "导入文件",
  source_api: "外部 API",
  source_database: "外部数据库",
  source_stream: "流式数据",
  source_webhook: "Webhook",
  transform_sql: "SQL 转换",
  transform_merge: "合并数据",
  transform_filter: "筛选数据",
  transform_aggregate: "聚合计算",
  transform_pivot: "行列转置",
  transform_deduplicate: "去重",
  transform_sort: "排序",
  transform_union: "合并",
  transform_custom_script: "自定义脚本",
  output_table: "输出到表",
  output_api: "推送到 API",
  output_file: "导出文件",
  output_notification: "通知",
  flow_branch: "条件分支",
  flow_switch: "多路分支",
  flow_parallel: "并行分发",
  flow_loop: "循环",
  flow_merge_all: "合并流",
};

export function getDefaultLabel(stepType: string): string {
  return STEP_LABEL_MAP[stepType] || stepType;
}

function getStepGroupFromType(stepType: string): "source" | "transform" | "output" | "flow" {
  if (stepType.startsWith("source_")) return "source";
  if (stepType.startsWith("transform_")) return "transform";
  if (stepType.startsWith("output_")) return "output";
  if (stepType.startsWith("flow_")) return "flow";
  return "transform";
}

// ─── 工具函数 ────────────────────────────────────────────

export function isTerminalStep(stepType: string): boolean {
  return stepType.startsWith("output_");
}

export function isSourceStep(stepType: string): boolean {
  return stepType.startsWith("source_");
}

export function getInputPortCount(stepType: string): number {
  if (["flow_merge_all", "transform_merge"].includes(stepType)) return 2;
  if (isSourceStep(stepType)) return 0;
  return 1;
}

export function getOutputPortCount(stepType: string): number {
  if (["flow_branch", "flow_switch", "flow_parallel"].includes(stepType)) return 3;
  if (isTerminalStep(stepType)) return 0;
  return 1;
}
