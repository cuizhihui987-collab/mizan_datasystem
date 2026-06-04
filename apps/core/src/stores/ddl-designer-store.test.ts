import { describe, it, expect, beforeEach } from "vitest";
import { useDDLDesignerStore } from "./ddl-designer-store";

describe("useDDLDesignerStore", () => {
  beforeEach(() => {
    useDDLDesignerStore.getState().reset();
  });

  it("初始状态包含一个空列", () => {
    const state = useDDLDesignerStore.getState();
    expect(state.columns).toHaveLength(1);
    expect(state.columns[0].dataType).toBe("STRING");
    expect(state.columns[0].ordinalPosition).toBe(1);
    expect(state.foreignKeys).toEqual([]);
    expect(state.indexes).toEqual([]);
    expect(state.triggers).toEqual([]);
    expect(state.isDirty).toBe(false);
  });

  describe("addColumn", () => {
    it("追加新列，ordinal 递增", () => {
      useDDLDesignerStore.getState().addColumn();
      const columns = useDDLDesignerStore.getState().columns;
      expect(columns).toHaveLength(2);
      expect(columns[1].ordinalPosition).toBe(2);
    });

    it("设置 isDirty = true", () => {
      useDDLDesignerStore.getState().addColumn();
      expect(useDDLDesignerStore.getState().isDirty).toBe(true);
    });
  });

  describe("updateColumn", () => {
    it("更新列的部分属性", () => {
      const colId = useDDLDesignerStore.getState().columns[0].id;
      useDDLDesignerStore.getState().updateColumn(colId, { logicalName: "名字", dataType: "INTEGER" });
      const col = useDDLDesignerStore.getState().columns[0];
      expect(col.logicalName).toBe("名字");
      expect(col.dataType).toBe("INTEGER");
    });
  });

  describe("removeColumn", () => {
    it("按 ID 删除列", () => {
      const colId = useDDLDesignerStore.getState().columns[0].id;
      useDDLDesignerStore.getState().addColumn();
      expect(useDDLDesignerStore.getState().columns).toHaveLength(2);
      useDDLDesignerStore.getState().removeColumn(colId);
      expect(useDDLDesignerStore.getState().columns).toHaveLength(1);
    });
  });

  describe("reorderColumns", () => {
    it("交换列位置后重新计算 ordinal", () => {
      useDDLDesignerStore.getState().addColumn();
      useDDLDesignerStore.getState().addColumn();
      // columns: [col1(ord=1), col2(ord=2), col3(ord=3)]
      // move from index 2 to index 0 => [col3(ord=1), col1(ord=2), col2(ord=3)]
      useDDLDesignerStore.getState().reorderColumns(2, 0);
      const cols = useDDLDesignerStore.getState().columns;
      expect(cols).toHaveLength(3);
      expect(cols[0].ordinalPosition).toBe(1);
      expect(cols[1].ordinalPosition).toBe(2);
      expect(cols[2].ordinalPosition).toBe(3);
    });
  });

  describe("addForeignKey", () => {
    it("添加默认 FK", () => {
      useDDLDesignerStore.getState().addForeignKey();
      const fks = useDDLDesignerStore.getState().foreignKeys;
      expect(fks).toHaveLength(1);
      expect(fks[0].constraintName).toBe("fk_1");
      expect(fks[0].onDelete).toBe("NO ACTION");
      expect(fks[0].onUpdate).toBe("NO ACTION");
    });
  });

  describe("updateForeignKey", () => {
    it("更新 FK 属性", () => {
      useDDLDesignerStore.getState().addForeignKey();
      const fkId = useDDLDesignerStore.getState().foreignKeys[0].id;
      useDDLDesignerStore.getState().updateForeignKey(fkId, { onDelete: "CASCADE" });
      expect(useDDLDesignerStore.getState().foreignKeys[0].onDelete).toBe("CASCADE");
    });
  });

  describe("removeForeignKey", () => {
    it("删除 FK", () => {
      useDDLDesignerStore.getState().addForeignKey();
      const fkId = useDDLDesignerStore.getState().foreignKeys[0].id;
      useDDLDesignerStore.getState().removeForeignKey(fkId);
      expect(useDDLDesignerStore.getState().foreignKeys).toHaveLength(0);
    });
  });

  describe("addIndex", () => {
    it("添加默认索引", () => {
      useDDLDesignerStore.getState().addIndex();
      const indexes = useDDLDesignerStore.getState().indexes;
      expect(indexes).toHaveLength(1);
      expect(indexes[0].indexName).toBe("idx_1");
      expect(indexes[0].isUnique).toBe(false);
    });
  });

  describe("updateIndex", () => {
    it("设置索引为 unique", () => {
      useDDLDesignerStore.getState().addIndex();
      const idxId = useDDLDesignerStore.getState().indexes[0].id;
      useDDLDesignerStore.getState().updateIndex(idxId, { isUnique: true });
      expect(useDDLDesignerStore.getState().indexes[0].isUnique).toBe(true);
    });
  });

  describe("removeIndex", () => {
    it("删除索引", () => {
      useDDLDesignerStore.getState().addIndex();
      const idxId = useDDLDesignerStore.getState().indexes[0].id;
      useDDLDesignerStore.getState().removeIndex(idxId);
      expect(useDDLDesignerStore.getState().indexes).toHaveLength(0);
    });
  });

  describe("addTrigger", () => {
    it("添加默认触发器", () => {
      useDDLDesignerStore.getState().addTrigger();
      const triggers = useDDLDesignerStore.getState().triggers;
      expect(triggers).toHaveLength(1);
      expect(triggers[0].timing).toBe("AFTER");
      expect(triggers[0].event).toBe("INSERT");
      expect(triggers[0].enabled).toBe(true);
    });
  });

  describe("updateTrigger", () => {
    it("更新触发器属性", () => {
      useDDLDesignerStore.getState().addTrigger();
      const trId = useDDLDesignerStore.getState().triggers[0].id;
      useDDLDesignerStore.getState().updateTrigger(trId, { event: "UPDATE" });
      expect(useDDLDesignerStore.getState().triggers[0].event).toBe("UPDATE");
    });
  });

  describe("removeTrigger", () => {
    it("删除触发器", () => {
      useDDLDesignerStore.getState().addTrigger();
      const trId = useDDLDesignerStore.getState().triggers[0].id;
      useDDLDesignerStore.getState().removeTrigger(trId);
      expect(useDDLDesignerStore.getState().triggers).toHaveLength(0);
    });
  });

  describe("validate", () => {
    it("空列时返回错误", () => {
      // Remove the initial column
      const colId = useDDLDesignerStore.getState().columns[0].id;
      useDDLDesignerStore.getState().removeColumn(colId);
      const errors = useDDLDesignerStore.getState().validate();
      expect(errors.some((e) => e.message.includes("至少需要定义一个字段"))).toBe(true);
    });

    it("未命名的列返回错误", () => {
      const errors = useDDLDesignerStore.getState().validate();
      expect(errors.some((e) => e.message.includes("所有字段都必须有名称"))).toBe(true);
    });

    it("FK 未选择源字段返回错误", () => {
      useDDLDesignerStore.getState().addForeignKey();
      const errors = useDDLDesignerStore.getState().validate();
      expect(errors.some((e) => e.message.includes("未选择源字段"))).toBe(true);
    });

    it("FK 未选择引用表返回错误", () => {
      useDDLDesignerStore.getState().addForeignKey();
      const errors = useDDLDesignerStore.getState().validate();
      expect(errors.some((e) => e.message.includes("未选择引用表"))).toBe(true);
    });

    it("索引未选择字段返回错误", () => {
      useDDLDesignerStore.getState().addIndex();
      const errors = useDDLDesignerStore.getState().validate();
      expect(errors.some((e) => e.message.includes("未选择字段"))).toBe(true);
    });
  });

  describe("loadFromDefinition", () => {
    it("从数据库定义加载状态", () => {
      useDDLDesignerStore.getState().loadFromDefinition({
        id: "t1",
        logicalName: "Test",
        physicalName: "mzan_tbl_test",
        columns: [{
          id: "c1", logicalName: "Name", physicalName: "name",
          dataType: "STRING", dataTypeArgs: null,
          isNullable: false, isPrimaryKey: true, isUnique: false,
          defaultValue: null, autoIncrement: false,
          ordinalPosition: 1, checkExpression: null,
        }],
        indexes: [{ id: "i1", indexName: "idx_name", columnIds: ["c1"], isUnique: true }],
        foreignKeys: [],
        triggers: [],
      });
      const state = useDDLDesignerStore.getState();
      expect(state.tableId).toBe("t1");
      expect(state.tableLogicalName).toBe("Test");
      expect(state.columns).toHaveLength(1);
      expect(state.columns[0].logicalName).toBe("Name");
      expect(state.indexes).toHaveLength(1);
      expect(state.isDirty).toBe(false);
    });
  });

  describe("reset", () => {
    it("恢复到初始状态", () => {
      useDDLDesignerStore.getState().addColumn();
      useDDLDesignerStore.getState().addForeignKey();
      useDDLDesignerStore.getState().reset();
      const state = useDDLDesignerStore.getState();
      expect(state.columns).toHaveLength(1);
      expect(state.foreignKeys).toEqual([]);
      expect(state.indexes).toEqual([]);
      expect(state.triggers).toEqual([]);
      expect(state.isDirty).toBe(false);
    });
  });
});
