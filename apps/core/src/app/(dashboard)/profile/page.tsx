"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { User, Camera } from "lucide-react";

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("获取失败");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { name?: string; bio?: string; image?: string }) => {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("保存失败");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      updateSession();
      toast.success("已更新");
      setEditing(false);
    },
    onError: () => toast.error("保存失败"),
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("图片不能超过 2MB"); return; }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      saveMutation.mutate({ image: dataUrl }, { onSettled: () => setUploading(false) });
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-3xl font-bold">个人资料</h1>

      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center overflow-hidden ring-2 ring-offset-2 ring-muted">
                {profile?.image ? (
                  <img src={profile.image} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <button
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="h-6 w-6 text-white" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>
            <p className="text-xs text-muted-foreground">{uploading ? "上传中..." : "点击更换头像"}</p>
          </div>

          {/* Info */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">邮箱</label>
              <p className="text-sm mt-0.5">{profile?.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">角色</label>
              <p className="text-sm mt-0.5">{profile?.role === "ADMIN" ? "管理员" : "普通用户"}</p>
            </div>

            {editing ? (
              <>
                <div>
                  <label className="text-sm font-medium">姓名</label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">简介</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full mt-1 h-20 text-sm rounded-md border border-input bg-background px-3 py-2 resize-none"
                    placeholder="介绍一下自己..."
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={() => saveMutation.mutate({ name: editName, bio: editBio })} disabled={saveMutation.isPending}>
                    保存
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(false)}>取消</Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">姓名</label>
                  <p className="text-sm mt-0.5">{profile?.name || "未设置"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">简介</label>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{profile?.bio || "暂无简介"}</p>
                </div>
                <Button variant="outline" onClick={() => { setEditName(profile?.name || ""); setEditBio(profile?.bio || ""); setEditing(true); }}>
                  编辑资料
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
