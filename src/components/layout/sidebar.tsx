"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import {
  Database,
  FileSpreadsheet,
  Settings,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Shield,
  Users,
  Key,
  Lock,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const navItems = [
  {
    title: "仪表盘",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "数据模型",
    href: "/schemas",
    icon: Database,
  },
  {
    title: "文件管理",
    href: "/files",
    icon: FolderOpen,
  },
  {
    title: "导入记录",
    href: "/imports",
    icon: FileSpreadsheet,
  },
  {
    title: "设置",
    href: "/settings",
    icon: Settings,
  },
];

const adminItems = [
  { title: "用户管理", href: "/settings/users", icon: Users },
  { title: "角色管理", href: "/settings/roles", icon: Key },
  { title: "权限管理", href: "/settings/permissions", icon: Lock },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className={cn("flex items-center gap-2", collapsed && "justify-center w-full")}>
          <Database className="h-6 w-6 text-primary" />
          {!collapsed && (
            <span className="font-semibold text-sidebar-foreground">Mizan 数据</span>
          )}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.title : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
        {isAdmin && !collapsed && (
          <div className="pt-4 pb-1 px-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              系统管理
            </p>
          </div>
        )}
        {isAdmin && adminItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.title : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full", collapsed && "px-0")}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              收起
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
