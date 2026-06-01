"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Shield, ChevronDown, ChevronRight } from "lucide-react";

interface UserInfo {
  id: string;
  name: string | null;
  email: string | null;
}

interface ColumnMeta {
  id: string;
  logicalName: string;
  physicalName: string;
  dataType: string;
}

interface ColumnPermissionUI {
  id?: string;
  columnId: string;
  columnPhysicalName: string;
  columnLogicalName: string;
  canRead: boolean;
  canWrite: boolean;
}

interface TablePermissionUI {
  id?: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  canSelect: boolean;
  canInsert: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  columnPermissions: ColumnPermissionUI[];
}

interface PermissionData {
  table: { id: string; logicalName: string };
  columns: ColumnMeta[];
  permissions: TablePermissionUI[];
}

interface PermissionDialogProps {
  tableId: string;
  tableName: string;
  children?: React.ReactNode;
}

export function PermissionDialog({ tableId, tableName, children }: PermissionDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [localPerms, setLocalPerms] = useState<TablePermissionUI[]>([]);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Fetch all users
  const { data: users, isLoading: usersLoading } = useQuery<UserInfo[]>({
    queryKey: ["users"],
    queryFn: () => fetch("/api/users").then((r) => r.json()),
  });

  // Fetch current permissions
  const { data: permData, isLoading: permsLoading, refetch } = useQuery<PermissionData>({
    queryKey: ["table-permissions", tableId],
    queryFn: () => fetch(`/api/tables/${tableId}/permissions`).then((r) => r.json()),
    enabled: open,
  });

  // Sync local state when data loads
  useEffect(() => {
    if (permData) {
      setLocalPerms(permData.permissions.map((p) => ({
        ...p,
        columnPermissions: p.columnPermissions.length > 0
          ? p.columnPermissions
          : permData.columns.map((c) => ({
              columnId: c.id,
              columnPhysicalName: c.physicalName,
              columnLogicalName: c.logicalName,
              canRead: true,
              canWrite: true,
            })),
      })));
    }
  }, [permData]);

  const toggleUser = (userId: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  // Toggle table-level permission for a user
  const setPerm = (userId: string, field: "canSelect" | "canInsert" | "canUpdate" | "canDelete", value: boolean) => {
    setLocalPerms((prev) => {
      const existing = prev.find((p) => p.userId === userId);
      if (existing) {
        return prev.map((p) =>
          p.userId === userId ? { ...p, [field]: value } : p
        );
      }
      // Add new entry
      const user = users?.find((u) => u.id === userId);
      return [
        ...prev,
        {
          userId,
          userName: user?.name || null,
          userEmail: user?.email || null,
          canSelect: field === "canSelect" ? value : true,
          canInsert: field === "canInsert" ? value : true,
          canUpdate: field === "canUpdate" ? value : true,
          canDelete: field === "canDelete" ? value : false,
          columnPermissions: permData?.columns.map((c) => ({
            columnId: c.id,
            columnPhysicalName: c.physicalName,
            columnLogicalName: c.logicalName,
            canRead: true,
            canWrite: true,
          })) || [],
        },
      ];
    });
  };

  // Toggle column-level permission
  const setColumnPerm = (
    userId: string,
    columnId: string,
    field: "canRead" | "canWrite",
    value: boolean
  ) => {
    setLocalPerms((prev) =>
      prev.map((p) =>
        p.userId === userId
          ? {
              ...p,
              columnPermissions: p.columnPermissions.map((cp) =>
                cp.columnId === columnId ? { ...cp, [field]: value } : cp
              ),
            }
          : p
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save each user's permissions
      for (const perm of localPerms) {
        // Only save if at least one permission is enabled
        if (!perm.canSelect && !perm.canInsert && !perm.canUpdate && !perm.canDelete) continue;

        // Determine if column permissions differ from defaults (all true)
        const hasColumnRestrictions = perm.columnPermissions.some(
          (cp) => !cp.canRead || !cp.canWrite
        );

        const res = await fetch(`/api/tables/${tableId}/permissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: perm.userId,
            canSelect: perm.canSelect,
            canInsert: perm.canInsert,
            canUpdate: perm.canUpdate,
            canDelete: perm.canDelete,
            columnPermissions: hasColumnRestrictions
              ? perm.columnPermissions.map((cp) => ({
                  columnId: cp.columnId,
                  canRead: cp.canRead,
                  canWrite: cp.canWrite,
                }))
              : [],
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "保存失败");
        }
      }

      // Remove users that were un-checked (all false)
      const savedUserIds = localPerms
        .filter((p) => p.canSelect || p.canInsert || p.canUpdate || p.canDelete)
        .map((p) => p.userId);
      const removedUserIds = permData?.permissions
        .filter((p) => !savedUserIds.includes(p.userId))
        .map((p) => p.userId) || [];

      for (const userId of removedUserIds) {
        await fetch(`/api/tables/${tableId}/permissions?userId=${userId}`, {
          method: "DELETE",
        });
      }

      toast.success("权限已保存");
      queryClient.invalidateQueries({ queryKey: ["table-permissions", tableId] });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const isLoading = usersLoading || permsLoading;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Shield className="h-4 w-4 mr-1" />
            权限管理
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>权限管理 — {tableName}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-2 space-y-2">
            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_70px_70px_70px] gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 rounded-md">
              <span>用户</span>
              <span className="text-center">查询</span>
              <span className="text-center">新增</span>
              <span className="text-center">更新</span>
              <span className="text-center">删除</span>
            </div>

            {users?.map((user) => {
              const perm = localPerms.find((p) => p.userId === user.id);
              const isExpanded = expandedUsers.has(user.id);
              return (
                <div key={user.id}>
                  <div className="grid grid-cols-[1fr_80px_70px_70px_70px] gap-2 items-center px-2 py-2 rounded-md hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => toggleUser(user.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <div className="truncate">
                        <span className="text-sm font-medium">
                          {user.name || user.email || user.id}
                        </span>
                        {user.name && user.email && (
                          <span className="text-xs text-muted-foreground ml-1.5">
                            ({user.email})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <Checkbox
                        checked={perm?.canSelect ?? false}
                        onCheckedChange={(v) =>
                          setPerm(user.id, "canSelect", v === true)
                        }
                      />
                    </div>
                    <div className="flex justify-center">
                      <Checkbox
                        checked={perm?.canInsert ?? false}
                        onCheckedChange={(v) =>
                          setPerm(user.id, "canInsert", v === true)
                        }
                      />
                    </div>
                    <div className="flex justify-center">
                      <Checkbox
                        checked={perm?.canUpdate ?? false}
                        onCheckedChange={(v) =>
                          setPerm(user.id, "canUpdate", v === true)
                        }
                      />
                    </div>
                    <div className="flex justify-center">
                      <Checkbox
                        checked={perm?.canDelete ?? false}
                        onCheckedChange={(v) =>
                          setPerm(user.id, "canDelete", v === true)
                        }
                      />
                    </div>
                  </div>

                  {/* Column-level permissions */}
                  {isExpanded && perm && (
                    <Collapsible open={isExpanded}>
                      <CollapsibleContent>
                        <div className="ml-8 mb-2 p-2 bg-muted/20 rounded-md border space-y-1">
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">
                            列级权限
                          </p>
                          <div className="grid grid-cols-[1fr_60px_60px] gap-2 px-1 py-1 text-xs text-muted-foreground">
                            <span>字段</span>
                            <span className="text-center">读取</span>
                            <span className="text-center">写入</span>
                          </div>
                          {perm.columnPermissions.map((cp) => (
                            <div
                              key={cp.columnId}
                              className="grid grid-cols-[1fr_60px_60px] gap-2 items-center px-1 py-1 rounded hover:bg-background/50"
                            >
                              <span className="text-xs truncate">
                                {cp.columnLogicalName}
                                <span className="text-muted-foreground ml-1">
                                  ({cp.columnPhysicalName})
                                </span>
                              </span>
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={cp.canRead}
                                  onCheckedChange={(v) =>
                                    setColumnPerm(user.id, cp.columnId, "canRead", v === true)
                                  }
                                />
                              </div>
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={cp.canWrite}
                                  onCheckedChange={(v) =>
                                    setColumnPerm(user.id, cp.columnId, "canWrite", v === true)
                                  }
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              );
            })}

            {(!users || users.length === 0) && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                暂无其他用户
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t shrink-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            关闭
          </Button>
          <Button onClick={handleSave} disabled={saving || isLoading}>
            {saving ? "保存中..." : "保存权限"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
