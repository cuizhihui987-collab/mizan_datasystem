import { describe, it, expect, beforeEach } from "vitest";
import { usePipelineStore } from "./pipeline-store";
import type { PipelineDefinition } from "@/lib/pipeline/pipeline-converter";

const mockPipeline: PipelineDefinition = {
  id: "p1",
  schemaId: "s1",
  name: "Test Pipeline",
  description: null,
  status: "DRAFT",
  edges: JSON.stringify([{ source: "step1", target: "step2" }]),
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
  steps: [
    { id: "step1", stepOrder: 0, stepType: "source_table", label: "Source", config: "{}", sourceTableId: null, outputPhysicalName: "mzan_pipe_1", status: "PENDING", errorLog: null, startedAt: null, completedAt: null, createdAt: "", updatedAt: "" },
    { id: "step2", stepOrder: 1, stepType: "output_table", label: "Output", config: "{}", sourceTableId: null, outputPhysicalName: "mzan_pipe_2", status: "PENDING", errorLog: null, startedAt: null, completedAt: null, createdAt: "", updatedAt: "" },
  ],
};

describe("usePipelineStore", () => {
  beforeEach(() => {
    usePipelineStore.getState().reset();
  });

  it("初始状态为空", () => {
    const state = usePipelineStore.getState();
    expect(state.nodes).toEqual([]);
    expect(state.edges).toEqual([]);
    expect(state.pipelineName).toBe("");
    expect(state.pipelineStatus).toBe("DRAFT");
    expect(state.isDirty).toBe(false);
    expect(state.isExecuting).toBe(false);
  });

  describe("loadPipeline", () => {
    it("加载 pipeline 数据和边", () => {
      usePipelineStore.getState().loadPipeline(mockPipeline);
      const state = usePipelineStore.getState();
      expect(state.nodes).toHaveLength(2);
      expect(state.edges).toHaveLength(1);
      expect(state.pipelineName).toBe("Test Pipeline");
      expect(state.isDirty).toBe(false);
    });

    it("兼容旧 pipeline（无 edges 时从步骤顺序生成）", () => {
      const oldPipeline = { ...mockPipeline, edges: "[]" };
      usePipelineStore.getState().loadPipeline(oldPipeline);
      const state = usePipelineStore.getState();
      expect(state.edges.length).toBeGreaterThan(0);
    });
  });

  describe("setNodes / setEdges", () => {
    it("设置 nodes 并标记 dirty", () => {
      usePipelineStore.getState().setNodes([{ id: "n1" }]);
      expect(usePipelineStore.getState().nodes).toHaveLength(1);
      expect(usePipelineStore.getState().isDirty).toBe(true);
    });

    it("设置 edges 并标记 dirty", () => {
      usePipelineStore.getState().setEdges([{ id: "e1", source: "a", target: "b" }]);
      expect(usePipelineStore.getState().isDirty).toBe(true);
    });
  });

  describe("execution state", () => {
    it("setExecuting", () => {
      usePipelineStore.getState().setExecuting(true);
      expect(usePipelineStore.getState().isExecuting).toBe(true);
    });

    it("setExecutionResult", () => {
      usePipelineStore.getState().setExecutionResult({ success: true });
      expect(usePipelineStore.getState().executionResult).toEqual({ success: true });
    });
  });

  describe("reset", () => {
    it("恢复到初始空状态", () => {
      usePipelineStore.getState().loadPipeline(mockPipeline);
      usePipelineStore.getState().reset();
      const state = usePipelineStore.getState();
      expect(state.nodes).toEqual([]);
      expect(state.edges).toEqual([]);
      expect(state.pipelineName).toBe("");
      expect(state.pipelineStatus).toBe("DRAFT");
    });
  });
});
