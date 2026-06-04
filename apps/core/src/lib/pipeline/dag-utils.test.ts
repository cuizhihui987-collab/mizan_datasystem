import { describe, it, expect } from "vitest";
import {
  topologicalSort,
  hasCycle,
  validateConnections,
  computeExecutionGroups,
  buildAdjacencyMap,
  buildInDegreeMap,
  buildIncomingMap,
  getInputTableNames,
  getStepGroup,
  isSourceStep,
  isTerminalStep,
  isBranchStep,
  isMergeStep,
} from "./dag-utils";
import type { PipelineFlowEdge } from "./dag-utils";
import type { PipelineStep } from "../pipeline-converter";

function makeStep(id: string, stepType: string, outputPhysicalName?: string): PipelineStep {
  return {
    id,
    stepOrder: 0,
    stepType,
    label: id,
    config: "{}",
    sourceTableId: null,
    outputPhysicalName: outputPhysicalName || `mzan_pipe_${id}`,
    status: "PENDING",
    errorLog: null,
    startedAt: null,
    completedAt: null,
    createdAt: "",
    updatedAt: "",
  };
}

function makeEdge(source: string, target: string, sourceHandle?: string, targetHandle?: string): PipelineFlowEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle: sourceHandle || "output",
    targetHandle: targetHandle || "input",
  };
}

describe("topologicalSort", () => {
  it("简单线性图", () => {
    const steps = [makeStep("a", "source_table"), makeStep("b", "transform_sql"), makeStep("c", "output_table")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c")];
    expect(topologicalSort(steps, edges)).toEqual(["a", "b", "c"]);
  });

  it("菱形图", () => {
    const steps = [makeStep("a", "source_table"), makeStep("b", "transform_sql"), makeStep("c", "transform_sql"), makeStep("d", "output_table")];
    const edges = [makeEdge("a", "b"), makeEdge("a", "c"), makeEdge("b", "d"), makeEdge("c", "d")];
    const result = topologicalSort(steps, edges);
    expect(result).toHaveLength(4);
    expect(result[0]).toBe("a");
    expect(result[3]).toBe("d");
  });

  it("存在环时返回空数组", () => {
    const steps = [makeStep("a", "source_table"), makeStep("b", "transform_sql"), makeStep("c", "output_table")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c"), makeEdge("c", "a")];
    expect(topologicalSort(steps, edges)).toEqual([]);
  });

  it("单个节点", () => {
    const steps = [makeStep("a", "source_table")];
    expect(topologicalSort(steps, [])).toEqual(["a"]);
  });

  it("不连通的节点", () => {
    const steps = [makeStep("a", "source_table"), makeStep("b", "source_table")];
    const result = topologicalSort(steps, []);
    expect(result).toHaveLength(2);
    expect(result).toContain("a");
    expect(result).toContain("b");
  });
});

describe("hasCycle", () => {
  it("检测无环图返回 false", () => {
    const edges = [makeEdge("a", "b"), makeEdge("b", "c")];
    expect(hasCycle(edges)).toBe(false);
  });

  it("检测有环图返回 true", () => {
    const edges = [makeEdge("a", "b"), makeEdge("b", "c"), makeEdge("c", "a")];
    expect(hasCycle(edges)).toBe(true);
  });
});

describe("validateConnections", () => {
  it("空图无错误", () => {
    expect(validateConnections([], [])).toEqual([]);
  });

  it("终端节点有出边时报错", () => {
    const steps = [makeStep("a", "output_table")];
    const edges = [makeEdge("a", "b")];
    const errors = validateConnections(steps, edges);
    expect(errors.some((e) => e.type === "output-output")).toBe(true);
  });

  it("重复边时报错", () => {
    const steps = [makeStep("a", "source_table"), makeStep("b", "output_table")];
    const edges = [makeEdge("a", "b"), makeEdge("a", "b")];
    const errors = validateConnections(steps, edges);
    expect(errors.some((e) => e.type === "duplicate")).toBe(true);
  });

  it("有环时报错", () => {
    const steps = [makeStep("a", "source_table"), makeStep("b", "transform_sql"), makeStep("c", "output_table")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c"), makeEdge("c", "a")];
    const errors = validateConnections(steps, edges);
    expect(errors.some((e) => e.type === "cycle")).toBe(true);
  });

  it("Branch 只有 1 条出边时报错", () => {
    const steps = [makeStep("a", "flow_branch"), makeStep("b", "output_table")];
    const edges = [makeEdge("a", "b")];
    const errors = validateConnections(steps, edges);
    expect(errors.some((e) => e.type === "branch-outputs")).toBe(true);
  });

  it("Branch 有 2 条出边时不报错", () => {
    const steps = [makeStep("a", "flow_branch"), makeStep("b", "output_table"), makeStep("c", "output_table")];
    const edges = [makeEdge("a", "b"), makeEdge("a", "c")];
    const errors = validateConnections(steps, edges);
    expect(errors.some((e) => e.type === "branch-outputs")).toBe(false);
  });
});

describe("computeExecutionGroups", () => {
  it("线性图分组正确", () => {
    const steps = [makeStep("a", "source_table"), makeStep("b", "transform_sql"), makeStep("c", "output_table")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c")];
    expect(computeExecutionGroups(steps, edges)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("并行节点在同一组", () => {
    const steps = [makeStep("a", "source_table"), makeStep("b", "transform_sql"), makeStep("c", "transform_sql")];
    const edges = [makeEdge("a", "b"), makeEdge("a", "c")];
    const groups = computeExecutionGroups(steps, edges);
    expect(groups[0]).toEqual(["a"]);
    expect(groups[1]).toHaveLength(2);
    expect(groups[1]).toContain("b");
    expect(groups[1]).toContain("c");
  });
});

describe("getStepGroup", () => {
  it("分类 source", () => {
    expect(getStepGroup("source_table")).toBe("source");
    expect(getStepGroup("source_api")).toBe("source");
  });
  it("分类 output", () => {
    expect(getStepGroup("output_table")).toBe("output");
  });
  it("分类 flow", () => {
    expect(getStepGroup("flow_branch")).toBe("flow");
    expect(getStepGroup("flow_merge_all")).toBe("flow");
  });
  it("默认 transform", () => {
    expect(getStepGroup("transform_sql")).toBe("transform");
    expect(getStepGroup("unknown")).toBe("transform");
  });
});

describe("布尔判断函数", () => {
  it("isSourceStep", () => {
    expect(isSourceStep("source_table")).toBe(true);
    expect(isSourceStep("output_table")).toBe(false);
  });
  it("isTerminalStep", () => {
    expect(isTerminalStep("output_table")).toBe(true);
    expect(isTerminalStep("source_table")).toBe(false);
  });
  it("isBranchStep", () => {
    expect(isBranchStep("flow_branch")).toBe(true);
    expect(isBranchStep("flow_switch")).toBe(true);
    expect(isBranchStep("source_table")).toBe(false);
  });
  it("isMergeStep", () => {
    expect(isMergeStep("flow_merge_all")).toBe(true);
    expect(isMergeStep("source_table")).toBe(false);
  });
});

describe("buildAdjacencyMap", () => {
  it("构建邻接表", () => {
    const edges = [makeEdge("a", "b"), makeEdge("a", "c")];
    const map = buildAdjacencyMap(edges);
    expect(map.get("a")).toEqual(["b", "c"]);
  });
});

describe("buildInDegreeMap", () => {
  it("构建入度表", () => {
    const steps = [makeStep("a", "source_table"), makeStep("b", "transform_sql")];
    const edges = [makeEdge("a", "b")];
    const map = buildInDegreeMap(steps, edges);
    expect(map.get("a")).toBe(0);
    expect(map.get("b")).toBe(1);
  });
});

describe("buildIncomingMap", () => {
  it("构建反向邻接表", () => {
    const edges = [makeEdge("a", "b"), makeEdge("c", "b")];
    const map = buildIncomingMap(edges);
    expect(map.get("b")).toEqual(["a", "c"]);
  });
});

describe("getInputTableNames", () => {
  it("获取上游输出表名", () => {
    const steps = [makeStep("a", "source_table", "mzan_pipe_a"), makeStep("b", "transform_sql", "mzan_pipe_b")];
    const edges = [makeEdge("a", "b")];
    const names = getInputTableNames("b", edges, steps);
    expect(names).toEqual(["mzan_pipe_a"]);
  });
});
