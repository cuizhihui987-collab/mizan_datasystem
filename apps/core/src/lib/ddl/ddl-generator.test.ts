import { describe, it, expect } from "vitest";
import { DDLGenerator } from "./ddl-generator";
import type { TableDefinitionFull } from "./ddl-generator";

describe("DDLGenerator", () => {
  const generator = new DDLGenerator();

  const baseDef: TableDefinitionFull = {
    tableId: "t1",
    logicalName: "测试表",
    physicalName: "mzan_tbl_test",
    columns: [],
    indexes: [],
    foreignKeys: [],
    triggers: [],
  };

  describe("generateCreateTable", () => {
    it("生成最基本的 CREATE TABLE", () => {
      const sql = generator.generateCreateTable(baseDef);
      expect(sql).toContain('CREATE TABLE "mzan_tbl_test"');
      expect(sql).toContain('"_id" INTEGER PRIMARY KEY AUTOINCREMENT');
      expect(sql).toContain('"_created_at" TEXT DEFAULT (datetime');
      expect(sql).toContain('"_updated_at" TEXT DEFAULT (datetime');
      expect(sql).toContain("PRAGMA foreign_keys = ON;");
    });

    it("包含用户定义列（STRING 类型）", () => {
      const def: TableDefinitionFull = {
        ...baseDef,
        columns: [
          {
            id: "c1", logicalName: "姓名", physicalName: "name",
            dataType: "STRING", dataTypeArgs: null,
            isNullable: true, isPrimaryKey: false, isUnique: false,
            defaultValue: null, autoIncrement: false,
            ordinalPosition: 1, checkExpression: null,
          },
        ],
      };
      const sql = generator.generateCreateTable(def);
      expect(sql).toContain('"name" VARCHAR(255)');
    });

    it("NOT NULL 约束", () => {
      const def: TableDefinitionFull = {
        ...baseDef,
        columns: [{
          id: "c1", logicalName: "必填", physicalName: "required_field",
          dataType: "STRING", dataTypeArgs: null,
          isNullable: false, isPrimaryKey: false, isUnique: false,
          defaultValue: null, autoIncrement: false,
          ordinalPosition: 1, checkExpression: null,
        }],
      };
      const sql = generator.generateCreateTable(def);
      expect(sql).toContain("NOT NULL");
    });

    it("DEFAULT 值", () => {
      const def: TableDefinitionFull = {
        ...baseDef,
        columns: [{
          id: "c1", logicalName: "状态", physicalName: "status",
          dataType: "STRING", dataTypeArgs: null,
          isNullable: true, isPrimaryKey: false, isUnique: false,
          defaultValue: "'active'", autoIncrement: false,
          ordinalPosition: 1, checkExpression: null,
        }],
      };
      const sql = generator.generateCreateTable(def);
      expect(sql).toContain("DEFAULT 'active'");
    });

    it("UNIQUE 约束生成 CONSTRAINT", () => {
      const def: TableDefinitionFull = {
        ...baseDef,
        columns: [
          {
            id: "c1", logicalName: "邮箱", physicalName: "email",
            dataType: "STRING", dataTypeArgs: null,
            isNullable: true, isPrimaryKey: false, isUnique: true,
            defaultValue: null, autoIncrement: false,
            ordinalPosition: 1, checkExpression: null,
          },
        ],
      };
      const sql = generator.generateCreateTable(def);
      expect(sql).toContain('CONSTRAINT "uq_mzan_tbl_test_email" UNIQUE');
    });

    it("CHECK 表达式", () => {
      const def: TableDefinitionFull = {
        ...baseDef,
        columns: [{
          id: "c1", logicalName: "价格", physicalName: "price",
          dataType: "INTEGER", dataTypeArgs: null,
          isNullable: true, isPrimaryKey: false, isUnique: false,
          defaultValue: null, autoIncrement: false,
          ordinalPosition: 1, checkExpression: "price > 0",
        }],
      };
      const sql = generator.generateCreateTable(def);
      expect(sql).toContain("CHECK (price > 0)");
    });

    it("索引生成", () => {
      const def: TableDefinitionFull = {
        ...baseDef,
        columns: [{
          id: "c1", logicalName: "状态", physicalName: "status_col",
          dataType: "STRING", dataTypeArgs: null,
          isNullable: true, isPrimaryKey: false, isUnique: false,
          defaultValue: null, autoIncrement: false,
          ordinalPosition: 1, checkExpression: null,
        }],
        indexes: [{
          id: "i1", indexName: "idx_status", columnIds: ["c1"], isUnique: false,
        }],
      };
      const sql = generator.generateCreateTable(def);
      expect(sql).toContain('CREATE INDEX "idx_status"');
      expect(sql).toContain('"status_col"');
    });

    it("唯一索引", () => {
      const def: TableDefinitionFull = {
        ...baseDef,
        columns: [{
          id: "c1", logicalName: "ID", physicalName: "uid",
          dataType: "STRING", dataTypeArgs: null,
          isNullable: true, isPrimaryKey: false, isUnique: false,
          defaultValue: null, autoIncrement: false,
          ordinalPosition: 1, checkExpression: null,
        }],
        indexes: [{
          id: "i1", indexName: "idx_uid", columnIds: ["c1"], isUnique: true,
        }],
      };
      const sql = generator.generateCreateTable(def);
      expect(sql).toContain("CREATE UNIQUE INDEX");
    });

    it("外键生成 ALTER TABLE", () => {
      const def: TableDefinitionFull = {
        ...baseDef,
        columns: [{
          id: "c1", logicalName: "用户ID", physicalName: "user_id",
          dataType: "INTEGER", dataTypeArgs: null,
          isNullable: true, isPrimaryKey: false, isUnique: false,
          defaultValue: null, autoIncrement: false,
          ordinalPosition: 1, checkExpression: null,
        }],
        foreignKeys: [{
          id: "fk1", constraintName: "fk_user",
          sourceColumnIds: ["c1"], referencedTableId: "t2",
          referencedPhysicalName: "mzan_tbl_user",
          refColumnIds: [], onDelete: "CASCADE", onUpdate: "NO ACTION",
        }],
      };
      const sql = generator.generateCreateTable(def);
      expect(sql).toContain('ALTER TABLE "mzan_tbl_test"');
      expect(sql).toContain('ADD CONSTRAINT "fk_user"');
      expect(sql).toContain("REFERENCES");
      expect(sql).toContain("ON DELETE CASCADE");
    });

    it("触发器生成", () => {
      const def: TableDefinitionFull = {
        ...baseDef,
        triggers: [{
          id: "tr1", triggerName: "trg_after_insert",
          timing: "AFTER", event: "INSERT",
          logic: "UPDATE counter SET count = count + 1;",
          enabled: true,
        }],
      };
      const sql = generator.generateCreateTable(def);
      expect(sql).toContain('CREATE TRIGGER "trg_after_insert"');
      expect(sql).toContain("AFTER INSERT ON");
      expect(sql).toContain("FOR EACH ROW");
    });

    it("禁用的触发器不生成", () => {
      const def: TableDefinitionFull = {
        ...baseDef,
        triggers: [{
          id: "tr1", triggerName: "trg_disabled",
          timing: "AFTER", event: "INSERT",
          logic: "DO NOTHING;",
          enabled: false,
        }],
      };
      const sql = generator.generateCreateTable(def);
      expect(sql).not.toContain("trg_disabled");
    });
  });

  describe("validate", () => {
    it("空列时返回错误", () => {
      const result = generator.validate(baseDef);
      expect(result.errors).toContain("至少需要定义一个字段");
    });

    it("重复物理列名返回错误", () => {
      const def: TableDefinitionFull = {
        ...baseDef,
        columns: [
          {
            id: "c1", logicalName: "a", physicalName: "dup",
            dataType: "STRING", dataTypeArgs: null,
            isNullable: true, isPrimaryKey: false, isUnique: false,
            defaultValue: null, autoIncrement: false,
            ordinalPosition: 1, checkExpression: null,
          },
          {
            id: "c2", logicalName: "b", physicalName: "dup",
            dataType: "STRING", dataTypeArgs: null,
            isNullable: true, isPrimaryKey: false, isUnique: false,
            defaultValue: null, autoIncrement: false,
            ordinalPosition: 2, checkExpression: null,
          },
        ],
      };
      const result = generator.validate(def);
      expect(result.errors.some((e) => e.includes("重复列名"))).toBe(true);
    });

    it("空名称返回错误", () => {
      const def: TableDefinitionFull = {
        ...baseDef,
        physicalName: "",
        logicalName: "",
      };
      const result = generator.validate(def);
      expect(result.errors).toContain("表名称不能为空");
    });

    it("有外键时产生警告", () => {
      const def: TableDefinitionFull = {
        ...baseDef,
        foreignKeys: [{ id: "fk1", constraintName: "fk_test", sourceColumnIds: [], referencedTableId: "t2", referencedPhysicalName: "t2", refColumnIds: [], onDelete: "NO ACTION", onUpdate: "NO ACTION" }],
      };
      const result = generator.validate(def);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
