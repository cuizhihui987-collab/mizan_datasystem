"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Shield, Trash2, Users, Key } from "lucide-react";

interface RoleItem {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  _count: { users: number; permissions: number };
}

interface PermissionItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  group: string;
}

interface RoleDetail extends RoleItem {
  permissions: { permission: PermissionItem }[];
}

interface PermissionGroup {
  group: string;
  permissions: PermissionItem[];
}

interface PermissionsResponse {
  permissions: PermissionItem[];
  groups: PermissionGroup[];
}

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleDetail | null>(null);

  // Create form state
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createPermIds, setCreatePermIds] = useState<string[]>([]);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPermIds, setEditPermIds] = useState<string[]>([]);
  const [deletingRole, setDeletingRole] = useState<RoleItem | null>(null);

  const { data: roles, isLoading } = useQuery<RoleItem[]>({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const res = await fetch("/api/admin/roles");
      if (!res.ok) throw new Error("获取角色列表失败");
      return res.json();
    },
  });

  const { data: permData } = useQuery<PermissionsResponse>({
    queryKey: ["admin-permissions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/permissions");
      if (!res.ok) throw new Error("获取权限列表失败");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; permissionIds?: string[] }) => {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "创建失败");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      toast.success("角色已创建");
      setCreateOpen(false);
      resetCreateForm();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "创建失败");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { roleId: string; name?: string; description?: string; permissionIds?: string[] }) => {
      const res = await fetch(`/api/admin/roles/${data.roleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "更新失败");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      toast.success("角色已更新");
      setEditRole(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "更新失败");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const res = await fetch(`/api/admin/roles/${roleId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      toast.success("角色已删除");
      setDeletingRole(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "删除失败");
    },
  });

  const resetCreateForm = () => {
    setCreateName("");
    setCreateDesc("");
    setCreatePermIds([]);
  };

  const openEdit = async (role: RoleItem) => {
    const res = await fetch(`/api/admin/roles/${role.id}`);
    const data: RoleDetail = await res.json();
    setEditRole(data);
    setEditName(data.name);
    setEditDesc(data.description || "");
    setEditPermIds(data.permissions.map((p) => p.permission.id));
  };

  const togglePermId = (id: string, current: string[], setter: (ids: string[]) => void) => {
    setter(current.includes(id) ? current.filter((i) => i !== id) : [...current, id]);
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          创建角色
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {roles?.map((role) => (
          <Card key={role.id}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {role.isSystem ? <Shield className="h-4 w-4" /> : <Key className="h-4 w-4" />}
                  {role.name}
                </CardTitle>
                {role.description && (
                  <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                )}
              </div>
              {role.isSystem && <Badge variant="secondary">系统角色</Badge>}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Key className="h-3.5 w-3.5" />
                    {role._count.permissions} 个权限
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {role._count.users} 个用户
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(role)}>
                    编辑
                  </Button>
                  {!role.isSystem && (
                    <AlertDialog
                      open={deletingRole?.id === role.id}
                      onOpenChange={(open) => !open && setDeletingRole(null)}
                    >
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => setDeletingRole(role)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除角色</AlertDialogTitle>
                          <AlertDialogDescription>
                            确定要删除角色「{role.name}」吗？
                            {role._count.users > 0 && (
                              <span className="block mt-2 text-destructive">
                                该角色下有 {role._count.users} 个用户，请先移除用户后再删除。
                              </span>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDeletingRole(null)}>
                            取消
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(role.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) { setCreateOpen(false); resetCreateForm(); }}}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>创建角色</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">角色名称</label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="输入角色名称"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">描述</label>
              <Textarea
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="角色描述（可选）"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">权限</label>
              {permData?.groups.map((group) => (
                <div key={group.group} className="border rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium capitalize">{group.group === "system" ? "系统" : group.group === "user" ? "用户管理" : group.group === "role" ? "角色管理" : "权限管理"}</p>
                  <div className="space-y-1.5">
                    {group.permissions.map((perm) => (
                      <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={createPermIds.includes(perm.id)}
                          onCheckedChange={() => togglePermId(perm.id, createPermIds, setCreatePermIds)}
                        />
                        <span className="text-sm">{perm.name}</span>
                        <span className="text-xs text-muted-foreground">({perm.code})</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetCreateForm(); }}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (createName.trim()) {
                  createMutation.mutate({
                    name: createName.trim(),
                    description: createDesc || undefined,
                    permissionIds: createPermIds,
                  });
                }
              }}
              disabled={!createName.trim() || createMutation.isPending}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editRole} onOpenChange={(open) => { if (!open) setEditRole(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑角色</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">角色名称</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={editRole?.isSystem}
                placeholder="输入角色名称"
              />
              {editRole?.isSystem && (
                <p className="text-xs text-muted-foreground">系统角色名称不可修改</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">描述</label>
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="角色描述（可选）"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">权限</label>
              {editRole?.isSystem ? (
                <div className="border rounded-lg p-3">
                  {editRole.permissions.map((rp) => (
                    <span key={rp.permission.id} className="inline-block bg-secondary text-secondary-foreground text-xs px-2 py-0.5 rounded mr-1 mb-1">
                      {rp.permission.name}
                    </span>
                  ))}
                  <p className="text-xs text-muted-foreground mt-2">系统角色权限不可修改</p>
                </div>
              ) : (
                permData?.groups.map((group) => (
                  <div key={group.group} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium capitalize">{group.group === "system" ? "系统" : group.group === "user" ? "用户管理" : group.group === "role" ? "角色管理" : "权限管理"}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          const allInGroup = group.permissions.map((p) => p.id);
                          const allSelected = allInGroup.every((id) => editPermIds.includes(id));
                          if (allSelected) {
                            setEditPermIds(editPermIds.filter((id) => !allInGroup.includes(id)));
                          } else {
                            const newIds = [...editPermIds];
                            for (const id of allInGroup) {
                              if (!newIds.includes(id)) newIds.push(id);
                            }
                            setEditPermIds(newIds);
                          }
                        }}
                      >
                        {group.permissions.every((p) => editPermIds.includes(p.id)) ? "取消全选" : "全选"}
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      {group.permissions.map((perm) => (
                        <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={editPermIds.includes(perm.id)}
                            onCheckedChange={() => togglePermId(perm.id, editPermIds, setEditPermIds)}
                          />
                          <span className="text-sm">{perm.name}</span>
                          <span className="text-xs text-muted-foreground">({perm.code})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRole(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (editRole && editName.trim()) {
                  updateMutation.mutate({
                    roleId: editRole.id,
                    name: editName.trim(),
                    description: editDesc || undefined,
                    ...(!editRole.isSystem ? { permissionIds: editPermIds } : {}),
                  });
                }
              }}
              disabled={!editName.trim() || updateMutation.isPending}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
