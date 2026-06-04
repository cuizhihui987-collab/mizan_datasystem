import { describe, it, expect } from "vitest";
import { stepToNode, stepsToNodes, edgesToFlowEdges, flowEdgesToJson, generateLinearEdges, getDefaultLabel, getInputPortCount, getOutputPortCount, isTerminalStep, isSourceStep } from "./pipeline-converter";
import type { PipelineStep } from "./pipeline-converter";

function makeStep(id: string, stepType: string, overrides?: Partial<PipelineStep>): PipelineStep {
  return {
    id,
    stepOrder: 0,
    stepType,
    label: null,
    config: "{}",
    sourceTableId: null,
    outputPhysicalName: `mzan_pipe_${id}`,
    status: "PENDING",
    errorLog: null,
    startedAt: null,
    completedAt: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("stepToNode", () => {
  it("将 step 转换为 ReactFlow node", () => {
    const step = makeStep("s1", "source_table", { config: JSON.stringify({ _nodePosition: { x: 100, y: 200 } }) });
    const node = stepToNode(step);
    expect(node.id).toBe("s1");
    expect(node.type).toBe("pipelineNode");
    expect(node.position).toEqual({ x: 100, y: 200 });
    expect(node.data.stepType).toBe("source_table");
    expect(node.data.label).toBe("source_table");
    expect(node.data.status).toBe("PENDING");
  });

  it("无位置配置时默认 (0,0)", () => {
    const step = makeStep("s1", "source_table");
    const node = stepToNode(step);
    expect(node.position).toEqual({ x: 0, y: 0 });
  });

  it("有 label 时使用 label", () => {
    const step = makeStep("s1", "source_table", { label: "My Label" });
    const node = stepToNode(step);
    expect(node.data.label).toBe("My Label");
  });

  it("summary 根据 stepType 生成", () => {
    const step = makeStep("s1", "source_table");
    const node = stepToNode(step);
    expect(node.data.summary).toContain("源表");
  });
});

describe("stepsToNodes", () => {
  it("批量转换", () => {
    const steps = [makeStep("s1", "source_table"), makeStep("s2", "output_table")];
    const nodes = stepsToNodes(steps);
    expect(nodes).toHaveLength(2);
  });
});

describe("edgesToFlowEdges", () => {
  it("解析 JSON 边数据", () => {
    const json = JSON.stringify([{ source: "a", target: "b" }]);
    const edges = edgesToFlowEdges(json);
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe("a");
    expect(edges[0].target).toBe("b");
  });

  it("JSON 解析失败返回空数组", () => {
    expect(edgesToFlowEdges("not-json")).toEqual([]);
  });

  it("缺失 id 时自动生成", () => {
    const json = JSON.stringify([{ source: "a", target: "b" }]);
    const edges = edgesToFlowEdges(json);
    expect(edges[0].id).toBeDefined();
  });
});

describe("flowEdgesToJson", () => {
  it("序列化为 JSON", () => {
    const edges = [{ id: "e1", source: "a", target: "b", sourceHandle: "output", targetHandle: "input" }];
    const json = flowEdgesToJson(edges);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].source).toBe("a");
  });

  it("往返一致", () => {
    const edges = [{ id: "e1", source: "a", target: "b", sourceHandle: "output", targetHandle: "input" }];
    const json = flowEdgesToJson(edges);
    const back = edgesToFlowEdges(json);
    expect(back[0].source).toBe("a");
    expect(back[0].target).toBe("b");
  });
});

describe("generateLinearEdges", () => {
  it("由 step 顺序生成边", () => {
    const steps = [makeStep("s1", "source_table"), makeStep("s2", "transform_sql"), makeStep("s3", "output_table")];
    const edges = generateLinearEdges(steps);
    expect(edges).toHaveLength(2);
    expect(edges[0].source).toBe("s1");
    expect(edges[0].target).toBe("s2");
    expect(edges[1].source).toBe("s2");
    expect(edges[1].target).toBe("s3");
  });

  it("所有边都有 animated=true", () => {
    const steps = [makeStep("s1", "source_table"), makeStep("s2", "output_table")];
    const edges = generateLinearEdges(steps);
    expect(edges.every((e) => e.animated)).toBe(true);
  });

  it("少于 2 个 step 返回空数组", () => {
    expect(generateLinearEdges([makeStep("s1", "source_table")])).toEqual([]);
  });
});

describe("getDefaultLabel", () => {
  it("已知类型返回中文标签", () => {
    expect(getDefaultLabel("source_table")).toBe("数据表");
    expect(getDefaultLabel("transform_sql")).toBe("SQL 转换");
    expect(getDefaultLabel("output_table")).toBe("输出到表");
    expect(getDefaultLabel("flow_branch")).toBe("条件分支");
  });

  it("未知类型返回原始值", () => {
    expect(getDefaultLabel("unknown_type")).toBe("unknown_type");
  });
});

describe("getInputPortCount", () => {
  it("merge 类型返回 2", () => {
    expect(getInputPortCount("flow_merge_all")).toBe(2);
    expect(getInputPortCount("transform_merge")).toBe(2);
  });
  it("source 类型返回 0", () => {
    expect(getInputPortCount("source_table")).toBe(0);
  });
  it("默认返回 1", () => {
    expect(getInputPortCount("transform_sql")).toBe(1);
    expect(getInputPortCount("output_table")).toBe(1);
  });
});

describe("getOutputPortCount", () => {
  it("branch/switch/parallel 返回 3", () => {
    expect(getOutputPortCount("flow_branch")).toBe(3);
    expect(getOutputPortCount("flow_switch")).toBe(3);
    expect(getOutputPortCount("flow_parallel")).toBe(3);
  });
  it("terminal 类型返回 0", () => {
    expect(getOutputPortCount("output_table")).toBe(0);
  });
  it("默认返回 1", () => {
    expect(getOutputPortCount("transform_sql")).toBe(1);
  });
});

describe("isTerminalStep / isSourceStep", () => {
  it("output_ 前缀为 terminal", () => {
    expect(isTerminalStep("output_table")).toBe(true);
    expect(isTerminalStep("source_table")).toBe(false);
  });
  it("source_ 前缀为 source", () => {
    expect(isSourceStep("source_table")).toBe(true);
    expect(isSourceStep("output_table")).toBe(false);
  });
});
