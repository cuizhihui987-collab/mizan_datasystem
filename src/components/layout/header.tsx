"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { User, LogOut, UserCircle, Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export function Header() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [notifOpen, setNotifOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: notifData } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markAllRead: true }) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const notifications: NotificationItem[] = notifData?.notifications || [];
  const unreadCount: number = notifData?.unreadCount || 0;

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-6">
      <div className="flex-1" />

      {/* Notifications */}
      <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-[14px] flex items-center justify-center rounded-full bg-destructive text-[9px] text-destructive-foreground font-medium px-1">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 max-h-96">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>通知</span>
            {unreadCount > 0 && (
              <button className="text-xs text-primary hover:underline flex items-center gap-1" onClick={() => markAllRead.mutate()}>
                <CheckCheck className="h-3 w-3" />全部已读
              </button>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="overflow-y-auto max-h-72">
            {notifications.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">暂无通知</p>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  className={cn("flex flex-col items-start gap-0.5 py-2 px-3 cursor-pointer", !n.read && "bg-muted/40")}
                  onClick={() => {
                    markRead.mutate(n.id);
                    setNotifOpen(false);
                    if (n.link) window.location.href = n.link;
                  }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-sm font-medium">{n.title}</span>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  {n.message && <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>}
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {new Date(n.createdAt).toLocaleString("zh-CN")}
                  </p>
                </DropdownMenuItem>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <User className="h-4 w-4" />
            <span className="text-sm">{session?.user?.name || session?.user?.email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>{session?.user?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile" className="cursor-pointer">
              <UserCircle className="mr-2 h-4 w-4" />
              个人资料
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
