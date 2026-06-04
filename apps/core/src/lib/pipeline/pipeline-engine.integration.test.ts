import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Prisma ────────────────────────────────────────────

const mockPrisma = {
  pipelineDefinition: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  pipelineStep: {
    update: vi.fn(),
  },
  tableDefinition: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  columnDefinition: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  storedFile: {
    findUnique: vi.fn(),
  },
  $executeRawUnsafe: vi.fn(),
  $queryRawUnsafe: vi.fn(),
};

vi.mock("@mizan/database", () => ({
  prisma: mockPrisma,
  Prisma: {},
}));

// ─── Mock SpreadsheetParser ─────────────────────────────────

vi.mock("@/lib/import/spreadsheet-parser", () => ({
  SpreadsheetParser: vi.fn().mockImplementation(() => ({
    parse: vi.fn().mockResolvedValue({
      headers: ["name", "age"],
      suggestedTypes: [
        { detectedType: "STRING" },
        { detectedType: "INTEGER" },
      ],
      sampleRows: [
        ["Alice", 30],
        ["Bob", 25],
      ],
    }),
  })),
}));

// ─── Mock global fetch ──────────────────────────────────────

const mockFetchResponse = (data: unknown) =>
  vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(data),
  });

// ─── Helpers ────────────────────────────────────────────────

function makeStep(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    stepOrder: 0,
    stepType: "source_table",
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

async function makeEngine() {
  const mod = await import("./pipeline-engine");
  return new mod.PipelineEngine();
}

describe("PipelineEngine - executeDAG", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: $queryRawUnsafe returns count
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ cnt: 10 }]);
    // Default: $executeRawUnsafe succeeds
    mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);
  });

  it("pipeline 不存在时返回错误", async () => {
    mockPrisma.pipelineDefinition.findUnique.mockResolvedValue(null);
    const engine = await makeEngine();

    const result = await engine.executeDAG("non-existent");
    expect(result.success).toBe(false);
    expect(result.error).toContain("不存在");
    expect(result.pipelineStatus).toBe("FAILED");
  });

  it("pipeline 正在运行时返回错误", async () => {
    mockPrisma.pipelineDefinition.findUnique.mockResolvedValue({
      id: "p1", status: "RUNNING", edges: "[]", steps: [],
    });
    const engine = await makeEngine();

    const result = await engine.executeDAG("p1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("正在执行中");
  });

  it("pipeline 无步骤时返回错误", async () => {
    mockPrisma.pipelineDefinition.findUnique.mockResolvedValue({
      id: "p1", status: "DRAFT", edges: "[]", steps: [],
    });
    const engine = await makeEngine();

    const result = await engine.executeDAG("p1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("没有任何步骤");
  });

  it("无边的 DAG 回退到线性 execute", async () => {
    const steps = [
      makeStep("s1", { stepType: "source_table", sourceTableId: "t1", config: "{}", outputPhysicalName: "mzan_pipe_1" }),
      makeStep("s2", { stepType: "output_table", config: JSON.stringify({ tableName: "output", overwriteIfExists: true, schemaId: "schema1" }), outputPhysicalName: "mzan_pipe_2" }),
    ];
    mockPrisma.pipelineDefinition.findUnique.mockResolvedValue({
      id: "p1", schemaId: "schema1", name: "Test", status: "DRAFT", edges: "[]", steps,
    });
    mockPrisma.tableDefinition.findUnique.mockResolvedValue({ id: "t1", physicalName: "mzan_tbl_src", status: "CREATED" });
    mockPrisma.tableDefinition.findFirst.mockResolvedValue(null);
    mockPrisma.tableDefinition.create.mockResolvedValue({ id: "new-table" });
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ cnt: 10 }])  // source_table count
      .mockResolvedValueOnce([{ name: "_id", type: "INTEGER" }, { name: "name", type: "TEXT" }])  // PRAGMA table_info
      .mockResolvedValueOnce([{ cnt: 10 }]);  // output_table count

    const engine = await makeEngine();
    const result = await engine.executeDAG("p1");

    expect(result.success).toBe(true);
    expect(result.pipelineStatus).toBe("COMPLETED");
    expect(result.stepResults).toHaveLength(2);
    expect(result.stepResults[0].status).toBe("COMPLETED");
    expect(result.stepResults[1].status).toBe("COMPLETED");
    // Pipeline status updated to RUNNING then COMPLETED
    expect(mockPrisma.pipelineDefinition.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "RUNNING" } })
    );
    expect(mockPrisma.pipelineDefinition.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "COMPLETED" } })
    );
  });

  it("有环依赖时返回错误", async () => {
    const steps = [
      makeStep("s1", { stepType: "source_table" }),
      makeStep("s2", { stepType: "transform_sql" }),
      makeStep("s3", { stepType: "output_table" }),
    ];
    // Create a cycle: s1 -> s2 -> s3 -> s1
    mockPrisma.pipelineDefinition.findUnique.mockResolvedValue({
      id: "p1", schemaId: "schema1", name: "Test", status: "DRAFT",
      edges: JSON.stringify([
        { source: "s1", target: "s2" },
        { source: "s2", target: "s3" },
        { source: "s3", target: "s1" },
      ]),
      steps,
    });

    const engine = await makeEngine();
    const result = await engine.executeDAG("p1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("循环依赖");
  });

  it("按拓扑序执行步骤", async () => {
    const steps = [
      makeStep("s1", { stepType: "source_table", sourceTableId: "t1", outputPhysicalName: "mzan_pipe_1" }),
      makeStep("s2", { stepType: "transform_sql", config: JSON.stringify({ sql: "SELECT * FROM {prev}" }), outputPhysicalName: "mzan_pipe_2" }),
      makeStep("s3", { stepType: "output_table", config: JSON.stringify({ tableName: "result", overwriteIfExists: true, schemaId: "schema1" }), outputPhysicalName: "mzan_pipe_3" }),
    ];
    mockPrisma.pipelineDefinition.findUnique.mockResolvedValue({
      id: "p1", schemaId: "schema1", name: "Test", status: "DRAFT",
      edges: JSON.stringify([
        { source: "s1", target: "s2" },
        { source: "s2", target: "s3" },
      ]),
      steps,
    });
    mockPrisma.tableDefinition.findUnique.mockResolvedValue({ id: "t1", physicalName: "mzan_tbl_src", status: "CREATED" });
    mockPrisma.tableDefinition.findFirst.mockResolvedValue(null);
    mockPrisma.tableDefinition.create.mockResolvedValue({ id: "new-table" });
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ cnt: 10 }])  // source_table
      .mockResolvedValueOnce([{ cnt: 5 }])   // transform_sql
      .mockResolvedValueOnce([{ name: "_id", type: "INTEGER" }, { name: "name", type: "TEXT" }])  // PRAGMA
      .mockResolvedValueOnce([{ cnt: 5 }]);  // output_table

    const engine = await makeEngine();
    const result = await engine.executeDAG("p1");

    expect(result.success).toBe(true);
    expect(result.stepResults).toHaveLength(3);
    // Verify executeDAG was called (not execute linear path)
    expect(mockPrisma.pipelineDefinition.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "RUNNING" } })
    );
  });

  it("步骤执行失败时标记为 FAILED", async () => {
    const steps = [
      makeStep("s1", { stepType: "source_table", sourceTableId: "nonexistent", outputPhysicalName: "mzan_pipe_1" }),
    ];
    mockPrisma.pipelineDefinition.findUnique.mockResolvedValue({
      id: "p1", schemaId: "schema1", name: "Test", status: "DRAFT",
      edges: "[]", steps,
    });
    // sourceTableId "nonexistent" won't return a result
    mockPrisma.tableDefinition.findUnique.mockResolvedValue(null);

    const engine = await makeEngine();
    const result = await engine.executeDAG("p1");

    expect(result.success).toBe(false);
    expect(result.pipelineStatus).toBe("FAILED");
    expect(result.stepResults[0].status).toBe("FAILED");
    // Pipeline marked as FAILED
    expect(mockPrisma.pipelineDefinition.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "FAILED" } })
    );
  });
});

// ─── executeStep 各类型测试 ─────────────────────────────────

describe("PipelineEngine - executeStep (individual types)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ cnt: 10 }]);
    mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);
  });

  describe("source_table", () => {
    it("复制源表数据", async () => {
      mockPrisma.tableDefinition.findUnique.mockResolvedValue({
        id: "t1", physicalName: "mzan_tbl_source", status: "CREATED",
      });

      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();
      const result = await engine["executeSourceTable"](
        { outputPhysicalName: "mzan_pipe_out", sourceTableId: "t1" },
        {}
      );
      expect(result.affectedRows).toBe(10);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        `DROP TABLE IF EXISTS "mzan_pipe_out"`
      );
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        `CREATE TABLE "mzan_pipe_out" AS SELECT * FROM "mzan_tbl_source"`
      );
    });

    it("源表不存在时抛出错误", async () => {
      mockPrisma.tableDefinition.findUnique.mockResolvedValue(null);
      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();

      await expect(
        engine["executeSourceTable"]({ outputPhysicalName: "out", sourceTableId: "bad" }, {})
      ).rejects.toThrow("不存在");
    });

    it("源表为 DRAFT 时抛出错误", async () => {
      mockPrisma.tableDefinition.findUnique.mockResolvedValue({
        id: "t1", physicalName: "mzan_tbl_draft", status: "DRAFT",
      });
      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();

      await expect(
        engine["executeSourceTable"]({ outputPhysicalName: "out", sourceTableId: "t1" }, {})
      ).rejects.toThrow("DRAFT");
    });
  });

  describe("transform_sql", () => {
    it("执行 SQL 转换", async () => {
      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();
      const result = await engine["executeTransformSql"](
        { outputPhysicalName: "mzan_pipe_out" },
        { sql: "SELECT * FROM {prev} WHERE status = 'active'" },
        "mzan_pipe_prev"
      );
      expect(result.affectedRows).toBe(10);
      // Verify $executeRawUnsafe was called at least twice (DROP + CREATE)
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("SELECT * FROM")
      );
    });

    it("空的 SQL 抛出错误", async () => {
      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();
      await expect(
        engine["executeTransformSql"](
          { outputPhysicalName: "out" },
          { sql: "" },
          null
        )
      ).rejects.toThrow("未指定 SQL");
    });

    it("不安全 SQL 抛出错误", async () => {
      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();
      await expect(
        engine["executeTransformSql"](
          { outputPhysicalName: "out" },
          { sql: "DROP TABLE users" },
          null
        )
      ).rejects.toThrow("仅允许");
    });
  });

  describe("transform_filter", () => {
    it("使用 filter 条件过滤数据", async () => {
      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();
      const result = await engine["executeTransformFilter"](
        { outputPhysicalName: "mzan_pipe_out" },
        {
          filters: {
            logic: "and",
            conditions: [{ column: "status", operator: "eq", value: "active" }],
          },
        },
        "mzan_pipe_prev"
      );
      expect(result.affectedRows).toBe(10);
    });

    it("无条件时抛出错误", async () => {
      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();
      await expect(
        engine["executeTransformFilter"](
          { outputPhysicalName: "out" },
          { filters: { logic: "and", conditions: [] } },
          "prev"
        )
      ).rejects.toThrow("未指定筛选条件");
    });

    it("无上游数据时抛出错误", async () => {
      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();
      await expect(
        engine["executeTransformFilter"](
          { outputPhysicalName: "out" },
          { filters: { logic: "and", conditions: [{ column: "x", operator: "eq", value: "1" }] } },
          null
        )
      ).rejects.toThrow("没有可用的上游数据");
    });
  });

  describe("output_table", () => {
    it("创建持久表并复制数据", async () => {
      mockPrisma.tableDefinition.findFirst.mockResolvedValue(null);
      mockPrisma.tableDefinition.create.mockResolvedValue({ id: "newTable" });
      mockPrisma.$queryRawUnsafe
        .mockReset()
        .mockResolvedValueOnce([{ name: "_id", type: "INTEGER" }, { name: "name", type: "TEXT" }, { name: "age", type: "INTEGER" }])
        .mockResolvedValueOnce([{ cnt: 5 }]);

      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();
      const result = await engine["executeOutputTable"](
        { outputPhysicalName: "mzan_pipe_out", sourceTableId: "step1" },
        { tableName: "输出表", overwriteIfExists: false, schemaId: "schema1" },
        "mzan_pipe_prev"
      );
      expect(result.affectedRows).toBe(5);
      expect(mockPrisma.tableDefinition.create).toHaveBeenCalled();
      expect(mockPrisma.columnDefinition.create).toHaveBeenCalledTimes(2);
    });

    it("无上游数据时抛出错误", async () => {
      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();
      await expect(
        engine["executeOutputTable"](
          { outputPhysicalName: "out" },
          { tableName: "t", schemaId: "s" },
          null
        )
      ).rejects.toThrow("没有可用的上游数据");
    });

    it("表已存在且未启用覆盖时抛出错误", async () => {
      mockPrisma.tableDefinition.findFirst.mockResolvedValue({
        id: "existing", logicalName: "输出表", physicalName: "mzan_tbl_existing", status: "CREATED",
      });
      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();
      await expect(
        engine["executeOutputTable"](
          { outputPhysicalName: "out" },
          { tableName: "输出表", overwriteIfExists: false, schemaId: "s1" },
          "prev"
        )
      ).rejects.toThrow("已存在");
    });

    it("表已存在且启用覆盖时删除重建", async () => {
      mockPrisma.tableDefinition.findFirst.mockResolvedValue({
        id: "existing", logicalName: "输出表", physicalName: "mzan_tbl_existing", status: "CREATED",
      });
      mockPrisma.tableDefinition.create.mockResolvedValue({ id: "newTable" });
      mockPrisma.$queryRawUnsafe
        .mockReset()
        .mockResolvedValueOnce([{ name: "_id", type: "INTEGER" }, { name: "val", type: "TEXT" }])
        .mockResolvedValueOnce([{ cnt: 3 }]);

      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();
      const result = await engine["executeOutputTable"](
        { outputPhysicalName: "out", sourceTableId: "step1" },
        { tableName: "输出表", overwriteIfExists: true, schemaId: "s1" },
        "prev"
      );
      expect(result.affectedRows).toBe(3);
      // Should delete existing physical table and metadata
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        `DROP TABLE IF EXISTS "mzan_tbl_existing"`
      );
      expect(mockPrisma.columnDefinition.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.tableDefinition.delete).toHaveBeenCalled();
    });
  });

  describe("transform_merge", () => {
    it("执行 JOIN 合并", async () => {
      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();
      const result = await engine["executeTransformMerge"](
        { outputPhysicalName: "mzan_pipe_out" },
        { joinType: "LEFT", leftOn: "id", rightOn: "user_id", rightSource: "mzan_tbl_users" },
        "mzan_pipe_prev"
      );
      expect(result.affectedRows).toBe(10);
    });

    it("不支持的 JOIN 类型抛出错误", async () => {
      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();
      await expect(
        engine["executeTransformMerge"](
          { outputPhysicalName: "out" },
          { joinType: "CROSS", leftOn: "id", rightOn: "id", rightSource: "t2" },
          "prev"
        )
      ).rejects.toThrow("不支持的 JOIN");
    });
  });

  describe("flow_merge_all", () => {
    it("UNION ALL 合并多表", async () => {
      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();
      const result = await engine["executeMergeAll"](
        { outputPhysicalName: "mzan_pipe_out" },
        ["mzan_pipe_a", "mzan_pipe_b"]
      );
      expect(result.affectedRows).toBe(10);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("UNION ALL")
      );
    });

    it("输入不足 2 个时抛出错误", async () => {
      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();
      await expect(
        engine["executeMergeAll"](
          { outputPhysicalName: "out" },
          ["mzan_pipe_a"]
        )
      ).rejects.toThrow("合并流需要至少 2 个输入");
    });
  });

  describe("source_api", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", mockFetchResponse([
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ]));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("从 API 拉取数据并写入表", async () => {
      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();
      const result = await engine["executeSourceApi"](
        { outputPhysicalName: "mzan_pipe_out" },
        { endpoint: "https://api.example.com/users", method: "GET" }
      );
      expect(result.affectedRows).toBe(2);
    });

    it("未指定端点时抛出错误", async () => {
      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();
      await expect(
        engine["executeSourceApi"](
          { outputPhysicalName: "out" },
          { endpoint: "" }
        )
      ).rejects.toThrow("未指定 API 端点");
    });

    it("使用 Basic Auth 时添加 Authorization header", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([{ data: "test" }]),
      });
      vi.stubGlobal("fetch", fetchSpy);

      const { PipelineEngine } = await import("./pipeline-engine");
      const engine = new PipelineEngine();
      await engine["executeSourceApi"](
        { outputPhysicalName: "out" },
        {
          endpoint: "https://api.example.com/secure",
          method: "GET",
          authType: "basic",
          authConfig: { username: "admin", password: "secret" },
        }
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/secure",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      );
    });
  });
});
