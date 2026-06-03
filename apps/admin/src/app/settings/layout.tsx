"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@mizan/shared-lib/utils";

const adminTabs = [
  { href: "/settings/users", label: "用户管理" },
  { href: "/settings/roles", label: "角色管理" },
  { href: "/settings/permissions", label: "权限管理" },
  { href: "/settings/storage", label: "存储设置" },
  { href: "/settings/sync", label: "数据同步" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">设置</h1>
        <p className="text-muted-foreground mt-1">系统配置</p>
      </div>

      <nav className="flex gap-1 border-b">
        <Link
          href="/settings"
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            pathname === "/settings"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          通用设置
        </Link>
        {isAdmin && adminTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              pathname.startsWith(tab.href)
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
