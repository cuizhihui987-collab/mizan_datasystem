"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Upload,
  Trash2,
  FileText,
  FolderOpen,
  HardDrive,
  Cloud,
  Download,
  Search,
  RefreshCw,
  Plus,
  Tag,
  Share2,
  X,
} from "lucide-react";

interface StoredFile {
  id: string;
  originalName: string;
  storageType: string;
  storagePath: string;
  fileSize: number;
  mimeType: string | null;
  bucket: string | null;
  userId: string | null;
  createdAt: string;
  url: string;
  tags: string[];
  folder: string;
}

interface FilesResponse {
  files: StoredFile[];
  total: number;
  page: number;
  pageSize: number;
}

interface BrowseEntry {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modifiedAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function FilesPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<StoredFile | null>(null);
  const [search, setSearch] = useState("");
  const [browsePath, setBrowsePath] = useState("");
  const [browseFiles, setBrowseFiles] = useState<BrowseEntry[] | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState("");
  const [editingTags, setEditingTags] = useState<StoredFile | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [sharingFile, setSharingFile] = useState<StoredFile | null>(null);
  const [shareUserId, setShareUserId] = useState("");
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string | null; email: string }>>([]);
  const [currentFolder, setCurrentFolder] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Load users for sharing
  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: async () => { const r = await fetch("/api/users"); return r.json(); },
  });
  useEffect(() => { if (usersData) setAllUsers(usersData); }, [usersData]);

  const { data, isLoading, error: queryError } = useQuery<FilesResponse>({
    queryKey: ["files", search, currentFolder, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set("search", search);
      if (currentFolder) params.set("folder", currentFolder);
      const res = await fetch(`/api/files?${params}`);
      if (!res.ok) throw new Error("获取文件列表失败");
      return res.json();
    },
  });

  // Fetch folders
  useQuery({
    queryKey: ["files-folders"],
    queryFn: async () => {
      const res = await fetch("/api/files?action=folders");
      const data = await res.json();
      setFolders(data.folders || []);
      return data;
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-folder", name }),
      });
      if (!res.ok) throw new Error("创建失败");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files-folders"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success("文件夹已创建");
      setShowNewFolder(false);
      setNewFolderName("");
    },
    onError: () => toast.error("创建文件夹失败"),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`/api/files?action=delete-folder&name=${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "删除失败" }));
        throw new Error(err.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files-folders"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success("文件夹已删除");
      setDeletingFolder("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "删除失败"),
  });

  const shareMutation = useMutation({
    mutationFn: async ({ fileId, userId }: { fileId: string; userId: string }) => {
      const res = await fetch(`/api/files/${fileId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "分享失败"); }
    },
    onSuccess: () => {
      toast.success("已分享");
      setSharingFile(null);
      setShareUserId("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "分享失败"),
  });

  const updateTagsMutation = useMutation({
    mutationFn: async ({ fileId, tags }: { fileId: string; tags: string[] }) => {
      const res = await fetch(`/api/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      if (!res.ok) throw new Error("更新失败");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success("标签已更新");
      setEditingTags(null);
    },
    onError: () => toast.error("更新标签失败"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await fetch(`/api/files/${fileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success("文件已删除");
      setDeletingFile(null);
    },
    onError: () => toast.error("删除失败"),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (currentFolder) formData.append("folder", currentFolder);
      const res = await fetch("/api/files", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "上传失败" }));
        throw new Error(err.error);
      }
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success("文件上传成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleBrowse = async () => {
    if (!browsePath.trim()) return;
    setBrowsing(true);
    try {
      const res = await fetch(`/api/files?action=browse&path=${encodeURIComponent(browsePath)}`);
      const data = await res.json();
      setBrowseFiles(data.files || []);
    } catch {
      toast.error("浏览目录失败");
    } finally {
      setBrowsing(false);
    }
  };

  const storageLabel = data?.files[0]?.storageType === "s3" ? "S3" : "本地";
  const storageIcon = data?.files[0]?.storageType === "s3" ? Cloud : HardDrive;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">文件管理</h1>
          <p className="text-muted-foreground mt-1">
            管理上传的文件，当前存储：{storageLabel}
          </p>
          {/* DEBUG: Remove after fixing */}
          {data && <div className="text-xs text-green-600">已加载: {data.total} 条, 页 {data.page}/{Math.ceil(data.total / pageSize)}</div>}
          {queryError && <div className="text-xs text-destructive">查询失败: {String(queryError)}</div>}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "上传中..." : "上传文件"}
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv,.json"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </Button>
        </div>
      </div>

      {/* Folder bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={currentFolder === "" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setCurrentFolder("")}
            >
              <FolderOpen className="h-3 w-3 mr-1" />
              全部
            </Button>
            {folders.filter((f) => f !== "/").map((f) => (
              <div key={f} className="flex items-center gap-0">
                <Button
                  variant={currentFolder === f ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs rounded-r-none"
                  onClick={() => { setCurrentFolder(f); setPage(1); }}
                >
                  <FolderOpen className="h-3 w-3 mr-1" />
                  {f.replace(/^\//, "")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-6 p-0 rounded-l-none text-destructive hover:text-destructive"
                  onClick={() => setDeletingFolder(f)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {showNewFolder ? (
              <div className="flex items-center gap-1">
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="文件夹名"
                  className="h-7 text-xs w-28"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newFolderName.trim()) {
                      createFolderMutation.mutate(newFolderName.trim());
                    }
                  }}
                  autoFocus
                />
                <Button size="sm" className="h-7 text-xs" onClick={() => {
                  if (newFolderName.trim()) createFolderMutation.mutate(newFolderName.trim());
                }} disabled={!newFolderName.trim() || createFolderMutation.isPending}>
                  确定
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}>
                  取消
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowNewFolder(true)}>
                <Plus className="h-3 w-3 mr-1" />
                新建文件夹
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete folder dialog */}
      <AlertDialog open={!!deletingFolder} onOpenChange={(open) => !open && setDeletingFolder("")}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除文件夹「{deletingFolder.replace(/^\//, "")}」吗？文件夹必须为空才能删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingFolder("")}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deletingFolder) deleteFolderMutation.mutate(deletingFolder); }}
              className="bg-destructive hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索文件..."
            className="pl-9"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["files"] })}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* File list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">加载失败，请刷新重试</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => queryClient.invalidateQueries({ queryKey: ["files"] })}>重试</Button>
          </CardContent>
        </Card>
      ) : (
        <>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {data.files.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">暂无文件</p>
                </div>
              ) : (
                data.files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText className="h-8 w-8 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{file.originalName}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatFileSize(file.fileSize)}</span>
                          <span>{file.createdAt ? formatDate(file.createdAt) : ""}</span>
                          <Badge variant="outline" className="text-xs">
                            {file.storageType === "s3" ? "S3" : "本地"}
                          </Badge>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {(file.tags || []).map((tag) => (
                              <span key={tag} className="inline-flex items-center text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingTags(file); setTagInput(""); }} title="编辑标签">
                          <Tag className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSharingFile(file)} title="分享">
                          <Share2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                        <a href={file.url} target="_blank" rel="noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      <AlertDialog
                        open={deletingFile?.id === file.id}
                        onOpenChange={(open) => !open && setDeletingFile(null)}
                      >
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => setDeletingFile(file)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认删除</AlertDialogTitle>
                            <AlertDialogDescription>
                              确定要删除文件「{file.originalName}」吗？此操作不可撤销。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDeletingFile(null)}>取消</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(file.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        {data && (
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-muted-foreground">
              共 {data.total} 条
              {queryError && <span className="text-destructive ml-2">(查询异常)</span>}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
              <span className="text-muted-foreground px-2">
                {data.total > 0 ? `第 ${page} / ${Math.ceil(data.total / pageSize)} 页` : ""}
              </span>
              <Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / pageSize)} onClick={() => setPage(page + 1)}>下一页</Button>
            </div>
          </div>
        )}
        </>
      )}

      {/* Tag edit dialog */}
      <Dialog open={!!editingTags} onOpenChange={(open) => { if (!open) setEditingTags(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>编辑标签</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="输入标签名"
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim() && editingTags) {
                    const newTags = [...(editingTags.tags || []), tagInput.trim()];
                    updateTagsMutation.mutate({ fileId: editingTags.id, tags: newTags });
                  }
                }}
              />
              <Button size="sm" className="h-8" onClick={() => {
                if (tagInput.trim() && editingTags) {
                  const newTags = [...(editingTags.tags || []), tagInput.trim()];
                  updateTagsMutation.mutate({ fileId: editingTags.id, tags: newTags });
                }
              }} disabled={!tagInput.trim() || updateTagsMutation.isPending}>
                添加
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[40px] border rounded-md p-2">
              {(editingTags?.tags || []).length === 0 ? (
                <span className="text-xs text-muted-foreground">暂无标签</span>
              ) : (
                (editingTags?.tags || []).map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                    {tag}
                    <button
                      className="hover:text-red-600"
                      onClick={() => {
                        if (editingTags) {
                          const newTags = (editingTags.tags || []).filter((t) => t !== tag);
                          updateTagsMutation.mutate({ fileId: editingTags.id, tags: newTags });
                        }
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share dialog */}
      <Dialog open={!!sharingFile} onOpenChange={(open) => { if (!open) { setSharingFile(null); setShareUserId(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>分享文件</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              将「{sharingFile?.originalName}」分享给：
            </p>
            <Select value={shareUserId} onValueChange={setShareUserId}>
              <SelectTrigger>
                <SelectValue placeholder="选择用户" />
              </SelectTrigger>
              <SelectContent>
                {allUsers.filter((u) => u.id !== session?.user?.id).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSharingFile(null); setShareUserId(""); }}>取消</Button>
            <Button onClick={() => { if (sharingFile && shareUserId) shareMutation.mutate({ fileId: sharingFile.id, userId: shareUserId }); }} disabled={!shareUserId || shareMutation.isPending}>
              分享
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
