import type { Edge } from "@xyflow/react";
import type { PipelineStep } from "./pipeline-converter";

// ─── Types ─────────────────────────────────────────────

export interface PipelineEdgeData extends Record<string, unknown> {
  /** 分支条件 (branch/switch) */
  condition?: string;
  /** 优先级 (switch case 排序) */
  priority?: number;
}

export type PipelineFlowEdge = Edge<PipelineEdgeData>;

export interface ValidationError {
  type: "cycle" | "source-input" | "output-output" | "branch-outputs" | "merge-inputs" | "duplicate";
  message: string;
  nodeIds?: string[];
}

// ─── 连接规则 ───────────────────────────────────────────

const SOURCE_TYPES = ["source_table", "source_import", "source_api"];
const TERMINAL_TYPES = ["output_table", "output_api", "output_file", "output_notification"];
const BRANCH_TYPES = ["flow_branch", "flow_switch"];
const MERGE_TYPES = ["flow_merge_all"];

function getStepType(id: string, steps: PipelineStep[]): string {
  return steps.find((s) => s.id === id)?.stepType || "";
}

/** 检查从 source 到 target 的边是否已存在 (用在 connect 验证时防止重复) */
function isDuplicateEdge(edges: PipelineFlowEdge[], source: string, target: string, sourceHandle?: string | null, targetHandle?: string | null): boolean {
  return edges.some(
    (e) => e.source === source && e.target === target && e.sourceHandle === sourceHandle && e.targetHandle === targetHandle
  );
}

// ─── 拓扑排序 (Kahn 算法) ────────────────────────────────

/**
 * 对有向无环图进行拓扑排序。
 * 返回按执行顺序排列的步骤 ID 数组。
 * 如果存在环, 返回空数组。
 */
export function topologicalSort(steps: PipelineStep[], edges: PipelineFlowEdge[]): string[] {
  const adj = buildAdjacencyMap(edges);
  const inDeg = buildInDegreeMap(steps, edges);

  const queue: string[] = [];
  for (const [id, deg] of inDeg) {
    if (deg === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    for (const neighbor of adj.get(node) || []) {
      const newDeg = (inDeg.get(neighbor) || 1) - 1;
      inDeg.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return result.length === steps.length ? result : [];
}

// ─── DAG 构建 ────────────────────────────────────────────

export function buildAdjacencyMap(edges: PipelineFlowEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const e of edges) {
    if (!map.has(e.source)) map.set(e.source, []);
    map.get(e.source)!.push(e.target);
  }
  return map;
}

export function buildInDegreeMap(steps: PipelineStep[], edges: PipelineFlowEdge[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of steps) map.set(s.id, 0);
  for (const e of edges) {
    map.set(e.target, (map.get(e.target) || 0) + 1);
  }
  return map;
}

/** 构建反向邻接表 (节点 → 上游节点列表) */
export function buildIncomingMap(edges: PipelineFlowEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const e of edges) {
    if (!map.has(e.target)) map.set(e.target, []);
    map.get(e.target)!.push(e.source);
  }
  return map;
}

/** 获取某步骤的上游输出表名列表 */
export function getInputTableNames(stepId: string, edges: PipelineFlowEdge[], steps: PipelineStep[]): string[] {
  const incoming = buildIncomingMap(edges);
  const sourceIds = incoming.get(stepId) || [];
  return sourceIds
    .map((id) => steps.find((s) => s.id === id)?.outputPhysicalName)
    .filter(Boolean) as string[];
}

// ─── 环检测 ──────────────────────────────────────────────

export function hasCycle(edges: PipelineFlowEdge[]): boolean {
  const adj = buildAdjacencyMap(edges);
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(node: string): boolean {
    visited.add(node);
    recStack.add(node);
    for (const neighbor of adj.get(node) || []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true;
      }
    }
    recStack.delete(node);
    return false;
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      if (dfs(node)) return true;
    }
  }
  return false;
}

// ─── 连接校验 ────────────────────────────────────────────

export function validateConnections(steps: PipelineStep[], edges: PipelineFlowEdge[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. 环检测
  if (hasCycle(edges)) {
    errors.push({ type: "cycle", message: "流程中存在循环依赖，请检查连线" });
  }

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const sourceType = getStepType(e.source, steps);

    // 2. 终端节点不能有出边
    if (TERMINAL_TYPES.includes(sourceType)) {
      errors.push({
        type: "output-output",
        message: `"${sourceType}" 是终点步骤，不能有输出连线`,
        nodeIds: [e.source],
      });
    }

    // 3. 重复连接 (跳过自身)
    for (let j = i + 1; j < edges.length; j++) {
      const other = edges[j];
      if (e.source === other.source && e.target === other.target) {
        errors.push({
          type: "duplicate",
          message: "重复的连接",
          nodeIds: [e.source, e.target],
        });
      }
    }
  }

  // 5. Branch/Switch 必须有至少 2 条出边
  for (const step of steps) {
    if (BRANCH_TYPES.includes(step.stepType)) {
      const outCount = edges.filter((e) => e.source === step.id).length;
      if (outCount > 0 && outCount < 2) {
        errors.push({
          type: "branch-outputs",
          message: `"${step.stepType}" 至少需要 2 条分支输出`,
          nodeIds: [step.id],
        });
      }
    }
  }

  return errors;
}

// ─── 执行分组 (并行执行) ─────────────────────────────────

/**
 * 将步骤分为可并行执行的组。
 * 同一组的步骤没有依赖关系，可并发执行。
 */
export function computeExecutionGroups(steps: PipelineStep[], edges: PipelineFlowEdge[]): string[][] {
  const order = topologicalSort(steps, edges);
  if (order.length === 0) return [];

  const inDeg = buildInDegreeMap(steps, edges);
  const adj = buildAdjacencyMap(edges);
  const groups: string[][] = [];
  const processed = new Set<string>();

  // 复制 inDeg 以便修改
  const currentDeg = new Map(inDeg);
  let remaining = new Set(order);

  while (remaining.size > 0) {
    const group: string[] = [];
    for (const id of remaining) {
      if ((currentDeg.get(id) || 0) === 0) {
        group.push(id);
      }
    }
    if (group.length === 0) break; // 防止无限循环

    for (const id of group) {
      remaining.delete(id);
      processed.add(id);
      for (const neighbor of adj.get(id) || []) {
        currentDeg.set(neighbor, (currentDeg.get(neighbor) || 1) - 1);
      }
    }
    groups.push(group);
  }

  return groups;
}

// ─── 分组分类 ────────────────────────────────────────────

export type StepGroup = "source" | "transform" | "output" | "flow";

export function getStepGroup(stepType: string): StepGroup {
  if (SOURCE_TYPES.includes(stepType)) return "source";
  if (TERMINAL_TYPES.includes(stepType)) return "output";
  if (BRANCH_TYPES.includes(stepType) || MERGE_TYPES.includes(stepType) || ["flow_parallel", "flow_loop"].includes(stepType)) return "flow";
  return "transform";
}

export function isSourceStep(stepType: string): boolean {
  return SOURCE_TYPES.includes(stepType);
}

export function isTerminalStep(stepType: string): boolean {
  return TERMINAL_TYPES.includes(stepType);
}

export function isBranchStep(stepType: string): boolean {
  return BRANCH_TYPES.includes(stepType);
}

export function isMergeStep(stepType: string): boolean {
  return MERGE_TYPES.includes(stepType);
}
