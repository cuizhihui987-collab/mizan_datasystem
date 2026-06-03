"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Key, Users, Lock, Settings } from "lucide-react";

interface PermissionItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  group: string;
}

interface PermissionGroup {
  group: string;
  permissions: PermissionItem[];
}

interface PermissionsResponse {
  permissions: PermissionItem[];
  groups: PermissionGroup[];
}

const groupIcons: Record<string, React.ReactNode> = {
  system: <Settings className="h-5 w-5" />,
  user: <Users className="h-5 w-5" />,
  role: <Key className="h-5 w-5" />,
  permission: <Lock className="h-5 w-5" />,
};

const groupLabels: Record<string, string> = {
  system: "系统管理",
  user: "用户管理",
  role: "角色管理",
  permission: "权限管理",
};

export default function PermissionsPage() {
  const { data, isLoading } = useQuery<PermissionsResponse>({
    queryKey: ["admin-permissions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/permissions");
      if (!res.ok) throw new Error("获取权限列表失败");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        系统权限列表，权限通过角色分配给用户。
      </p>

      {data?.groups.map((group) => (
        <Card key={group.group}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {groupIcons[group.group] || <Shield className="h-5 w-5" />}
              {groupLabels[group.group] || group.group}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y rounded-lg border">
              {group.permissions.map((perm) => (
                <div key={perm.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-medium">{perm.name}</p>
                    {perm.description && (
                      <p className="text-xs text-muted-foreground">{perm.description}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {perm.code}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
