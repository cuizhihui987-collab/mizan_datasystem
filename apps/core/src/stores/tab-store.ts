"use client";

import { create } from "zustand";

export interface TabItem {
  id: string;       // unique identifier (usually the path)
  label: string;    // display name
  path: string;     // URL path for navigation
  icon?: string;    // optional icon identifier
}

interface TabStore {
  tabs: TabItem[];
  activeTabId: string | null;

  // Actions
  openTab: (tab: TabItem) => void;
  closeTab: (tabId: string) => void;
  closeOthers: (tabId: string) => void;
  closeRight: (tabId: string) => void;
  closeAll: () => void;
  setActiveTab: (tabId: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
}

/** 默认首页 tab */
const HOME_TAB: TabItem = { id: "/", label: "仪表盘", path: "/" };

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [HOME_TAB],
  activeTabId: "/",

  openTab: (tab) => {
    const { tabs } = get();
    const existing = tabs.find((t) => t.id === tab.id);
    if (existing) {
      // 已存在则切换到它
      set({ activeTabId: tab.id });
      return;
    }
    // 新 tab: 如果当前只有首页 tab 且用户不是去首页，则替换首页
    if (tabs.length === 1 && tabs[0].id === "/" && tab.id !== "/") {
      set({ tabs: [tab], activeTabId: tab.id });
      return;
    }
    set({ tabs: [...tabs, tab], activeTabId: tab.id });
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    if (tabId === "/") return; // 首页不允许关闭

    const newTabs = tabs.filter((t) => t.id !== tabId);
    let newActive = activeTabId;

    if (activeTabId === tabId) {
      // 关闭的是当前 tab: 选右边的，没有则选左边的
      const idx = tabs.findIndex((t) => t.id === tabId);
      newActive = newTabs[Math.min(idx, newTabs.length - 1)]?.id || "/";
    }

    set({ tabs: newTabs.length === 0 ? [HOME_TAB] : newTabs, activeTabId: newActive });
  },

  closeOthers: (tabId) => {
    const { activeTabId } = get();
    const keepTab = get().tabs.find((t) => t.id === tabId);
    const homeTab = get().tabs.find((t) => t.id === "/");
    const toKeep = [keepTab!, homeTab!].filter(Boolean);
    // deduplicate
    const unique = toKeep.filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i);
    set({
      tabs: unique,
      activeTabId: unique.find((t) => t.id === activeTabId) ? activeTabId : unique[0]?.id || "/",
    });
  },

  closeRight: (tabId) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    const newTabs = tabs.slice(0, idx + 1);
    const newActive = newTabs.find((t) => t.id === activeTabId) ? activeTabId : newTabs[newTabs.length - 1]?.id || "/";
    set({ tabs: newTabs, activeTabId: newActive });
  },

  closeAll: () => {
    set({ tabs: [HOME_TAB], activeTabId: "/" });
  },

  setActiveTab: (tabId) => {
    set({ activeTabId: tabId });
  },

  reorderTabs: (fromIndex, toIndex) => {
    const { tabs } = get();
    const newTabs = [...tabs];
    const [moved] = newTabs.splice(fromIndex, 1);
    newTabs.splice(toIndex, 0, moved);
    set({ tabs: newTabs });
  },
}));
