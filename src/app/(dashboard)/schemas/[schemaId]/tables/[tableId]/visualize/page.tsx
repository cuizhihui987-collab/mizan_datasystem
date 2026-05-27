"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer } from "@/components/charts/chart-container";
import { ArrowLeft } from "lucide-react";

export default function VisualizePage() {
  const params = useParams();
  const router = useRouter();
  const tableId = params.tableId as string;

  const { data: table, isLoading } = useQuery({
    queryKey: ["table", tableId],
    queryFn: () => fetch(`/api/tables/${tableId}`).then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  if (table?.status === "DRAFT") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold">数据可视化</h1>
            <p className="text-muted-foreground mt-1">
              请先在 DDL 设计器中执行建表操作
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {table?.logicalName || "数据"} - 可视化
          </h1>
          <p className="text-muted-foreground mt-1">
            通过图表分析数据
          </p>
        </div>
      </div>

      <ChartContainer tableId={tableId} />
    </div>
  );
}
