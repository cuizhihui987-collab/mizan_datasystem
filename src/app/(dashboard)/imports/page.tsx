"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet } from "lucide-react";

interface ImportJob {
  id: string;
  fileName: string;
  fileSize: number;
  totalRows: number | null;
  processedRows: number | null;
  errorRows: number | null;
  status: string;
  createdAt: string;
  table: { logicalName: string } | null;
  schema: { name: string };
}

export default function ImportsPage() {
  const { data: imports = [], isLoading } = useQuery<ImportJob[]>({
    queryKey: ["imports"],
    queryFn: () => fetch("/api/imports").then((r) => r.json()),
  });

  const statusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "success" | "destructive" | "warning"> = {
      PENDING: "secondary",
      PROCESSING: "warning",
      COMPLETED: "success",
      FAILED: "destructive",
      CANCELLED: "secondary",
    };
    const labels: Record<string, string> = {
      PENDING: "等待中",
      PROCESSING: "处理中",
      COMPLETED: "已完成",
      FAILED: "失败",
      CANCELLED: "已取消",
    };
    return <Badge variant={map[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">导入记录</h1>
        <p className="text-muted-foreground mt-1">查看文件导入历史和状态</p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : imports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">还没有导入记录</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">所有导入</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {imports.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{job.fileName}</p>
                    <p className="text-sm text-muted-foreground">
                      {job.schema.name} / {job.table?.logicalName || "未关联表"} · {Math.round(job.fileSize / 1024)}KB
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {job.totalRows && (
                      <span className="text-sm text-muted-foreground">
                        {job.processedRows || 0}/{job.totalRows}
                      </span>
                    )}
                    {statusBadge(job.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
