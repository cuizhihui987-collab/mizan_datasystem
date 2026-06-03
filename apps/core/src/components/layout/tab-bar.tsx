"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@mizan/shared-lib/utils";
import { useTabStore, type TabItem } from "@/stores/tab-store";
import { X, Home, ChevronRight } from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";

// ─── 路径 → 标签映射 ────────────────────────────────────

const TAB_LABELS: Record<string, string> = {
  "/": "仪表盘",
  "/schemas": "数据模型",
  "/files": "文件管理",
  "/imports": "导入记录",
  "/profile": "个人资料",
  "/settings": "通用设置",
  "/settings/users": "用户管理",
  "/settings/roles": "角色管理",
  "/settings/permissions": "权限管理",
  "/settings/storage": "存储设置",
  "/settings/sync": "数据同步",
};

function getTabLabel(pathname: string): string {
  // Exact match first
  if (TAB_LABELS[pathname]) return TAB_LABELS[pathname];

  // Pattern match for dynamic routes
  if (pathname.includes("/schemas/") && !pathname.split("/").slice(3).length) return "数据模型详情";
  if (pathname.includes("/tables/new")) return "新建数据表";
  if (pathname.includes("/pipelines/")) return "ETL 工作流";
  if (pathname.includes("/dashboards/")) return "看板";
  if (pathname.includes("/tables/") && pathname.endsWith("/data")) return "数据浏览";
  if (pathname.includes("/tables/") && pathname.endsWith("/ddl-designer")) return "DDL 设计器";
  if (pathname.includes("/tables/") && pathname.endsWith("/visualize")) return "可视化";
  if (pathname.includes("/tables/")) return "表详情";
  if (pathname.includes("/import")) return "导入数据";
  if (pathname.includes("/api-docs")) return "API 文档";

  return pathname.split("/").filter(Boolean).pop() || "未知";
}

// ─── Navigation Tracker ─────────────────────────────────

function useNavigationTracker() {
  const pathname = usePathname();
  const { openTab, tabs } = useTabStore();
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;

    const label = getTabLabel(pathname);
    openTab({ id: pathname, label, path: pathname });
  }, [pathname, openTab]);
}

// ─── Tab Bar Component ──────────────────────────────────

export function TabBar() {
  const { tabs, activeTabId, closeTab, closeOthers, closeRight, closeAll, setActiveTab } =
    useTabStore();

  // Track navigation
  useNavigationTracker();

  if (tabs.length <= 1 && tabs[0]?.id === "/") return null;

  return (
    <div className="flex items-center h-9 bg-muted/30 border-b overflow-hidden shrink-0">
      {/* Scrollable tab list */}
      <div className="flex-1 flex items-center overflow-x-auto scrollbar-none gap-px px-1">
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onSelect={() => setActiveTab(tab.id)}
            onClose={() => closeTab(tab.id)}
            onCloseOthers={() => closeOthers(tab.id)}
            onCloseRight={() => closeRight(tab.id)}
          />
        ))}
      </div>

      {/* Tab actions */}
      <div className="flex items-center gap-0.5 px-2 border-l shrink-0">
        <button
          onClick={closeAll}
          className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-accent transition-colors"
          title="关闭所有标签"
        >
          全部关闭
        </button>
      </div>
    </div>
  );
}

// ─── Single Tab Item ────────────────────────────────────

function TabItem({
  tab,
  isActive,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseRight,
}: {
  tab: TabItem;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseRight: () => void;
}) {
  const isHome = tab.id === "/";

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <Link
          href={tab.path}
          onClick={(e) => {
            if (isActive) e.preventDefault();
            onSelect();
          }}
          className={cn(
            "group relative flex items-center gap-1 px-2.5 py-1 text-xs whitespace-nowrap rounded-t-md border-b-2 transition-colors cursor-pointer select-none",
            isActive
              ? "border-primary bg-background text-foreground font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
        >
          {isHome && <Home className="h-3 w-3" />}
          <span className="truncate max-w-[120px]">{tab.label}</span>
          {!isHome && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="ml-1 rounded-sm p-px opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20 transition-opacity"
              onFocus={(e) => e.stopPropagation()}
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Link>
      </ContextMenuTrigger>

      {!isHome && (
        <ContextMenuContent className="min-w-[160px]">
          <ContextMenuItem onClick={onClose}>关闭标签</ContextMenuItem>
          <ContextMenuItem onClick={onCloseOthers}>关闭其他标签</ContextMenuItem>
          <ContextMenuItem onClick={onCloseRight}>关闭右侧标签</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              useTabStore.getState().closeAll();
            }}
          >
            关闭所有标签
          </ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}
