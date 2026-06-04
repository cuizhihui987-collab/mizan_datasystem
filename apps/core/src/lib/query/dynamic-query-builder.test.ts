import { describe, it, expect } from "vitest";
import { DynamicQueryBuilder } from "./dynamic-query-builder";

describe("DynamicQueryBuilder", () => {
  const builder = new DynamicQueryBuilder("mzan_tbl_test");

  // ─── buildSelectQuery ──────────────────────────────

  describe("buildSelectQuery", () => {
    it("生成默认 SELECT 语句", () => {
      const { sql } = builder.buildSelectQuery({ page: 1, pageSize: 20 });
      expect(sql).toBe(
        `SELECT * FROM "mzan_tbl_test"  ORDER BY "_id" ASC LIMIT 20 OFFSET 0`
      );
    });

    it("生成 COUNT 语句", () => {
      const { countSql } = builder.buildSelectQuery({ page: 1, pageSize: 20 });
      expect(countSql).toBe(
        `SELECT COUNT(*) as total FROM "mzan_tbl_test" `
      );
    });

    it("page=0 时被 clamp 到 1", () => {
      const { sql } = builder.buildSelectQuery({ page: 0, pageSize: 20 });
      expect(sql).toContain("OFFSET 0");
    });

    it("pageSize=500 被 clamp 到 100", () => {
      const { sql } = builder.buildSelectQuery({ page: 1, pageSize: 500 });
      expect(sql).toContain("LIMIT 100");
    });

    it("pageSize=0 被 clamp 到 1", () => {
      const { sql } = builder.buildSelectQuery({ page: 1, pageSize: 0 });
      expect(sql).toContain("LIMIT 1");
    });

    it("支持列投影", () => {
      const { sql } = builder.buildSelectQuery({
        page: 1, pageSize: 10,
        columns: ["id", "name"],
      });
      expect(sql).toContain(`SELECT "id", "name"`);
    });

    it("排序字段被 sanitize", () => {
      const { sql } = builder.buildSelectQuery({
        page: 1, pageSize: 10,
        sort: "id; DROP TABLE users",
      });
      // The sanitize removes all non-alphanumeric chars and CJK
      expect(sql).toContain(`ORDER BY "idDROPTABLEusers"`);
    });

    it("支持降序排序", () => {
      const { sql } = builder.buildSelectQuery({
        page: 1, pageSize: 10,
        sort: "created_at", order: "desc",
      });
      expect(sql).toContain("ORDER BY \"created_at\" DESC");
    });
  });

  // ─── Filters ───────────────────────────────────────

  describe("filters", () => {
    it("eq 过滤", () => {
      const { sql } = builder.buildSelectQuery({
        page: 1, pageSize: 10,
        filters: { logic: "and", conditions: [{ column: "status", operator: "eq", value: "active" }] },
      });
      expect(sql).toContain(`WHERE "status" = 'active'`);
    });

    it("neq 过滤", () => {
      const { sql } = builder.buildSelectQuery({
        page: 1, pageSize: 10,
        filters: { logic: "and", conditions: [{ column: "status", operator: "neq", value: "archived" }] },
      });
      expect(sql).toContain(`"status" != 'archived'`);
    });

    it("contains 过滤", () => {
      const { sql } = builder.buildSelectQuery({
        page: 1, pageSize: 10,
        filters: { logic: "and", conditions: [{ column: "name", operator: "contains", value: "test" }] },
      });
      expect(sql).toContain(`"name" LIKE '%test%'`);
    });

    it("startsWith 过滤", () => {
      const { sql } = builder.buildSelectQuery({
        page: 1, pageSize: 10,
        filters: { logic: "and", conditions: [{ column: "name", operator: "startsWith", value: "abc" }] },
      });
      expect(sql).toContain(`"name" LIKE 'abc%'`);
    });

    it("endsWith 过滤", () => {
      const { sql } = builder.buildSelectQuery({
        page: 1, pageSize: 10,
        filters: { logic: "and", conditions: [{ column: "name", operator: "endsWith", value: "xyz" }] },
      });
      expect(sql).toContain(`"name" LIKE '%xyz'`);
    });

    it("gt/gte/lt/lte 过滤", () => {
      const { sql: gtSql } = builder.buildSelectQuery({
        page: 1, pageSize: 10,
        filters: { logic: "and", conditions: [{ column: "age", operator: "gt", value: "18" }] },
      });
      expect(gtSql).toContain(`"age" > '18'`);

      const { sql: gteSql } = builder.buildSelectQuery({
        page: 1, pageSize: 10,
        filters: { logic: "and", conditions: [{ column: "age", operator: "gte", value: "18" }] },
      });
      expect(gteSql).toContain(`"age" >= '18'`);
    });

    it("isEmpty 过滤", () => {
      const { sql } = builder.buildSelectQuery({
        page: 1, pageSize: 10,
        filters: { logic: "and", conditions: [{ column: "email", operator: "isEmpty", value: "" }] },
      });
      expect(sql).toContain(`("email" IS NULL OR "email" = '')`);
    });

    it("isNotEmpty 过滤", () => {
      const { sql } = builder.buildSelectQuery({
        page: 1, pageSize: 10,
        filters: { logic: "and", conditions: [{ column: "email", operator: "isNotEmpty", value: "" }] },
      });
      expect(sql).toContain(`("email" IS NOT NULL AND "email" != '')`);
    });

    it("OR 逻辑", () => {
      const { sql } = builder.buildSelectQuery({
        page: 1, pageSize: 10,
        filters: {
          logic: "or",
          conditions: [
            { column: "status", operator: "eq", value: "active" },
            { column: "status", operator: "eq", value: "pending" },
          ],
        },
      });
      expect(sql).toContain(" OR ");
    });

    it("空条件数组不产生 WHERE", () => {
      const { sql } = builder.buildSelectQuery({
        page: 1, pageSize: 10,
        filters: { logic: "and", conditions: [] },
      });
      expect(sql).not.toContain("WHERE");
    });

    it("SQL 注入: 值中的单引号被转义", () => {
      const { sql } = builder.buildSelectQuery({
        page: 1, pageSize: 10,
        filters: { logic: "and", conditions: [{ column: "name", operator: "eq", value: "O'Brien" }] },
      });
      expect(sql).toContain("'O''Brien'");
    });
  });

  // ─── buildInsertQuery ──────────────────────────────

  describe("buildInsertQuery", () => {
    it("生成 INSERT 语句", () => {
      const { sql } = builder.buildInsertQuery({ name: "Test", age: 25 });
      expect(sql).toBe(
        `INSERT INTO "mzan_tbl_test" ("name", "age") VALUES ('Test', 25)`
      );
    });

    it("null 值输出 NULL", () => {
      const { sql } = builder.buildInsertQuery({ name: null });
      expect(sql).toContain("NULL");
    });

    it("undefined 值输出 NULL", () => {
      const { sql } = builder.buildInsertQuery({ name: undefined });
      expect(sql).toContain("NULL");
    });

    it("特殊字符转义", () => {
      const { sql } = builder.buildInsertQuery({ name: "It's a test" });
      expect(sql).toContain("'It''s a test'");
    });
  });

  // ─── buildUpdateQuery ──────────────────────────────

  describe("buildUpdateQuery", () => {
    it("生成 UPDATE 语句", () => {
      const { sql } = builder.buildUpdateQuery(1, { name: "Updated" });
      expect(sql).toBe(
        `UPDATE "mzan_tbl_test" SET "name" = 'Updated' WHERE "_id" = 1`
      );
    });

    it("PK 为字符串时转为数字", () => {
      const { sql } = builder.buildUpdateQuery("42", { name: "Test" });
      expect(sql).toContain('"_id" = 42');
    });
  });

  // ─── buildDeleteQuery ──────────────────────────────

  describe("buildDeleteQuery", () => {
    it("生成 DELETE 语句", () => {
      const { sql } = builder.buildDeleteQuery(5);
      expect(sql).toBe(
        `DELETE FROM "mzan_tbl_test" WHERE "_id" = 5`
      );
    });
  });
});
