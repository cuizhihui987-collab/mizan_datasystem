import { describe, it, expect, beforeEach } from "vitest";
import { useTabStore } from "./tab-store";

describe("useTabStore", () => {
  beforeEach(() => {
    useTabStore.getState().closeAll();
  });

  it("初始状态只有首页 tab", () => {
    const state = useTabStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].id).toBe("/");
    expect(state.activeTabId).toBe("/");
  });

  describe("openTab", () => {
    it("打开新 tab 并激活（替换首页）", () => {
      useTabStore.getState().openTab({ id: "/schemas", label: "Schemas", path: "/schemas" });
      const state = useTabStore.getState();
      // Only home tab exists, so it gets replaced
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe("/schemas");
      expect(state.activeTabId).toBe("/schemas");
    });

    it("在已有多 tab 时追加新 tab", () => {
      useTabStore.setState({
        tabs: [
          { id: "/", label: "仪表盘", path: "/" },
          { id: "/schemas", label: "Schemas", path: "/schemas" },
        ],
        activeTabId: "/schemas",
      });
      useTabStore.getState().openTab({ id: "/new", label: "New", path: "/new" });
      expect(useTabStore.getState().tabs).toHaveLength(3);
      expect(useTabStore.getState().activeTabId).toBe("/new");
    });

    it("已存在的 tab 只切换不重复添加", () => {
      useTabStore.getState().openTab({ id: "/schemas", label: "Schemas", path: "/schemas" });
      useTabStore.getState().openTab({ id: "/schemas", label: "Schemas", path: "/schemas" });
      expect(useTabStore.getState().tabs).toHaveLength(1);
    });

    it("只在首页时，新 tab 替换首页（除非去首页）", () => {
      useTabStore.getState().openTab({ id: "/schemas", label: "Schemas", path: "/schemas" });
      const state = useTabStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe("/schemas");
    });
  });

  describe("closeTab", () => {
    it("关闭非首页 tab", () => {
      useTabStore.getState().openTab({ id: "/schemas", label: "Schemas", path: "/schemas" });
      useTabStore.getState().closeTab("/schemas");
      expect(useTabStore.getState().tabs).toHaveLength(1);
      expect(useTabStore.getState().activeTabId).toBe("/");
    });

    it("关闭当前 tab 时切换到右边的 tab", () => {
      useTabStore.getState().openTab({ id: "/a", label: "A", path: "/a" });
      useTabStore.getState().openTab({ id: "/b", label: "B", path: "/b" });
      useTabStore.getState().setActiveTab("/a");
      useTabStore.getState().closeTab("/a");
      expect(useTabStore.getState().activeTabId).toBe("/b");
    });

    it("不允许关闭首页", () => {
      useTabStore.getState().closeTab("/");
      expect(useTabStore.getState().tabs).toHaveLength(1);
    });
  });

  describe("closeOthers", () => {
    it("只保留指定 tab 和首页", () => {
      useTabStore.setState({
        tabs: [
          { id: "/", label: "仪表盘", path: "/" },
          { id: "/a", label: "A", path: "/a" },
          { id: "/b", label: "B", path: "/b" },
          { id: "/c", label: "C", path: "/c" },
        ],
        activeTabId: "/b",
      });
      useTabStore.getState().closeOthers("/b");
      const ids = useTabStore.getState().tabs.map((t) => t.id);
      expect(ids).toContain("/b");
      expect(ids).toContain("/");
      expect(ids).not.toContain("/a");
      expect(ids).not.toContain("/c");
    });
  });

  describe("closeAll", () => {
    it("恢复到仅首页", () => {
      useTabStore.getState().openTab({ id: "/a", label: "A", path: "/a" });
      useTabStore.getState().closeAll();
      expect(useTabStore.getState().tabs).toHaveLength(1);
      expect(useTabStore.getState().activeTabId).toBe("/");
    });
  });

  describe("setActiveTab", () => {
    it("切换活动 tab", () => {
      useTabStore.getState().setActiveTab("/some-path");
      expect(useTabStore.getState().activeTabId).toBe("/some-path");
    });
  });

  describe("reorderTabs", () => {
    it("交换 tab 顺序", () => {
      useTabStore.getState().openTab({ id: "/a", label: "A", path: "/a" });
      useTabStore.getState().openTab({ id: "/b", label: "B", path: "/b" });
      useTabStore.getState().reorderTabs(1, 2);
      expect(useTabStore.getState().tabs[1].id).toBe("/b");
    });
  });
});
