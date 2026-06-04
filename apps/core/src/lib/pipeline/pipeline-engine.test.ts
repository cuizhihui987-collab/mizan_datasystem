import { describe, it, expect } from "vitest";
import { generatePhysicalName, safeIdentifier, isSQLSafe } from "./pipeline-engine";

// NOTE: These test the helper functions extracted from pipeline-engine.ts.
// The PipelineEngine class itself requires Prisma mocking for integration tests.

describe("generatePhysicalName", () => {
  it("以 mzan_pipe_ 开头", () => {
    const name = generatePhysicalName();
    expect(name.startsWith("mzan_pipe_")).toBe(true);
  });

  it("总长度为 18", () => {
    const name = generatePhysicalName();
    expect(name.startsWith("mzan_pipe_")).toBe(true);
    // "mzan_pipe_" = 10 chars + 10 random chars = 20
    expect(name).toHaveLength(20);
  });

  it("只包含小写字母和数字", () => {
    const name = generatePhysicalName();
    expect(name).toMatch(/^mzan_pipe_[a-z0-9]{10}$/);
  });

  it("多次调用产生不同结果", () => {
    const names = new Set(Array.from({ length: 100 }, () => generatePhysicalName()));
    expect(names.size).toBe(100);
  });
});

describe("safeIdentifier", () => {
  it("保留字母数字和下划线", () => {
    expect(safeIdentifier("hello_world_123")).toBe("hello_world_123");
  });

  it("移除特殊字符", () => {
    expect(safeIdentifier("drop;--")).toBe("drop");
  });

  it("保留中文字符", () => {
    expect(safeIdentifier("你好_abc")).toBe("你好_abc");
  });

  it("移除双引号", () => {
    expect(safeIdentifier('evil"name')).toBe("evilname");
  });
});

describe("isSQLSafe", () => {
  it("允许 SELECT 查询", () => {
    expect(isSQLSafe("SELECT * FROM users")).toBeNull();
  });

  it("允许 WITH 查询", () => {
    expect(isSQLSafe("WITH cte AS (SELECT 1) SELECT * FROM cte")).toBeNull();
  });

  it("拒绝 DROP TABLE", () => {
    expect(isSQLSafe("DROP TABLE users")).not.toBeNull();
  });

  it("拒绝 INSERT", () => {
    expect(isSQLSafe("INSERT INTO users VALUES (1)")).not.toBeNull();
  });

  it("拒绝 UPDATE", () => {
    expect(isSQLSafe("UPDATE users SET name='x'")).not.toBeNull();
  });

  it("拒绝 DELETE", () => {
    expect(isSQLSafe("DELETE FROM users")).not.toBeNull();
  });

  it("拒绝 CREATE", () => {
    expect(isSQLSafe("CREATE TABLE x (id INT)")).not.toBeNull();
  });

  it("拒绝 ALTER", () => {
    expect(isSQLSafe("ALTER TABLE x ADD COLUMN y INT")).not.toBeNull();
  });

  it("拒绝 ALTER（小写）", () => {
    expect(isSQLSafe("alter table x add column y")).not.toBeNull();
  });

  it("拒绝包含 DROP DATABASE", () => {
    expect(isSQLSafe("SELECT * FROM x; DROP DATABASE y")).not.toBeNull();
  });

  it("拒绝包含 GRANT", () => {
    expect(isSQLSafe("SELECT * FROM x; GRANT ALL TO y")).not.toBeNull();
  });
});
