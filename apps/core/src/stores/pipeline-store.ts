"use client";

import { create } from "zustand";
import type { PipelineDefinition } from "@/lib/pipeline/pipeline-converter";
import { stepsToNodes, edgesToFlowEdges, flowEdgesToJson, generateLinearEdges } from "@/lib/pipeline/pipeline-converter";

// ─── Types ──────────────────────────────────────────────

export interface CanvasStore {
  // 画布数据
  nodes: object[];
  edges: object[];
  pipelineName: string;
  pipelineStatus: string;
  schemaId: string | null;
  pipelineId: string | null;

  // 状态
  isDirty: boolean;
  isExecuting: boolean;
  executionResult: Record<string, unknown> | null;
  viewMode: "canvas" | "list";

  // Actions
  loadPipeline: (pipeline: PipelineDefinition) => void;
  setNodes: (nodes: object[]) => void;
  setEdges: (edges: object[]) => void;
  setPipelineMeta: (name: string, status: string) => void;
  setDirty: (dirty: boolean) => void;
  setExecuting: (executing: boolean) => void;
  setExecutionResult: (result: Record<string, unknown> | null) => void;
  setViewMode: (mode: "canvas" | "list") => void;
  reset: () => void;
}

// ─── Store ──────────────────────────────────────────────

export const usePipelineStore = create<CanvasStore>((set) => ({
  nodes: [],
  edges: [],
  pipelineName: "",
  pipelineStatus: "DRAFT",
  schemaId: null,
  pipelineId: null,
  isDirty: false,
  isExecuting: false,
  executionResult: null,
  viewMode: "canvas",

  loadPipeline: (pipeline: PipelineDefinition) => {
    let edges = edgesToFlowEdges(pipeline.edges);
    // 兼容旧 pipeline: 没有 edges 时从 stepOrder 生成线性边
    if (edges.length === 0 && pipeline.steps.length > 1) {
      edges = generateLinearEdges(pipeline.steps);
    }
    set({
      nodes: stepsToNodes(pipeline.steps),
      edges,
      pipelineName: pipeline.name,
      pipelineStatus: pipeline.status,
      schemaId: pipeline.schemaId,
      pipelineId: pipeline.id,
      isDirty: false,
      isExecuting: false,
      executionResult: null,
    });
  },

  setNodes: (nodes) => set({ nodes, isDirty: true }),
  setEdges: (edges) => set({ edges, isDirty: true }),
  setPipelineMeta: (name, status) => set({ pipelineName: name, pipelineStatus: status, isDirty: true }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  setExecuting: (executing) => set({ isExecuting: executing }),
  setExecutionResult: (result) => set({ executionResult: result }),
  setViewMode: (mode) => set({ viewMode: mode }),

  reset: () =>
    set({
      nodes: [],
      edges: [],
      pipelineName: "",
      pipelineStatus: "DRAFT",
      schemaId: null,
      pipelineId: null,
      isDirty: false,
      isExecuting: false,
      executionResult: null,
    }),
}));
