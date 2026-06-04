import { describe, it, expect, beforeEach } from "vitest";
import { useBatchImportStore } from "./batch-import-store";
import type { BackgroundTask } from "./batch-import-store";

function makeTask(id: string, overrides?: Partial<BackgroundTask>): BackgroundTask {
  return {
    id,
    tableId: "t1",
    fileName: "test.xlsx",
    totalRows: 100,
    processedRows: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    status: "pending",
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("useBatchImportStore", () => {
  beforeEach(() => {
    useBatchImportStore.setState({ tasks: [] });
  });

  it("初始状态为空任务列表", () => {
    expect(useBatchImportStore.getState().tasks).toEqual([]);
  });

  describe("addTask", () => {
    it("添加任务", () => {
      useBatchImportStore.getState().addTask(makeTask("t1"));
      expect(useBatchImportStore.getState().tasks).toHaveLength(1);
    });
  });

  describe("updateTask", () => {
    it("更新任务的部分属性", () => {
      useBatchImportStore.getState().addTask(makeTask("t1"));
      useBatchImportStore.getState().updateTask("t1", { status: "processing", processedRows: 50 });
      const task = useBatchImportStore.getState().tasks[0];
      expect(task.status).toBe("processing");
      expect(task.processedRows).toBe(50);
    });
  });

  describe("removeTask", () => {
    it("删除任务", () => {
      useBatchImportStore.getState().addTask(makeTask("t1"));
      useBatchImportStore.getState().addTask(makeTask("t2"));
      useBatchImportStore.getState().removeTask("t1");
      expect(useBatchImportStore.getState().tasks).toHaveLength(1);
    });
  });

  describe("getActiveTasks", () => {
    it("返回活跃任务（排除已完成的）", () => {
      useBatchImportStore.getState().addTask(makeTask("t1", { tableId: "t1", status: "pending" }));
      useBatchImportStore.getState().addTask(makeTask("t2", { tableId: "t1", status: "completed" }));
      useBatchImportStore.getState().addTask(makeTask("t3", { tableId: "t1", status: "failed" }));
      const active = useBatchImportStore.getState().getActiveTasks("t1");
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe("t1");
    });

    it("只返回指定 tableId 的任务", () => {
      useBatchImportStore.getState().addTask(makeTask("t1", { tableId: "t1" }));
      useBatchImportStore.getState().addTask(makeTask("t2", { tableId: "t2" }));
      const active = useBatchImportStore.getState().getActiveTasks("t1");
      expect(active.every((t) => t.tableId === "t1")).toBe(true);
    });
  });
});
