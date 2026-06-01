"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface ParseResult {
  headers: string[];
  sampleRows: unknown[][];
  totalRows: number;
  suggestedTypes: Array<{
    columnIndex: number;
    columnName: string;
    detectedType: string;
    confidence: number;
    nullCount: number;
  }>;
}

interface StepParsePreviewProps {
  importId: string;
  onConfirm: (
    headers: string[],
    suggestedTypes: ParseResult["suggestedTypes"],
    totalRows: number
  ) => void;
  onBack: () => void;
}

export function StepParsePreview({
  importId,
  onConfirm,
  onBack,
}: StepParsePreviewProps) {
  const [headerRow, setHeaderRow] = useState(1);

  const { data, isLoading, error, refetch } = useQuery<ParseResult>({
    queryKey: ["parse", importId, headerRow],
    queryFn: () =>
      fetch(`/api/imports/${importId}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headerRow }),
      }).then((r) => r.json()),
    enabled: !!importId,
  });

  const typeBadge = (type: string) => {
    const colors: Record<string, "default" | "secondary" | "success" | "warning"> = {
      STRING: "default",
      INTEGER: "success",
      FLOAT: "warning",
      BOOLEAN: "secondary",
      DATE: "secondary",
      DATETIME: "secondary",
    };
    return <Badge variant={colors[type] || "default"}>{type}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium">表头行号</label>
          <Input
            type="number"
            min={1}
            value={headerRow}
            onChange={(e) => {
              setHeaderRow(Number(e.target.value));
            }}
          />
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          重新解析
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="p-3 text-sm text-destructive">
            解析失败，请确认表头行号正确后重试
          </CardContent>
        </Card>
      ) : data ? (
        <>
          <p className="text-sm text-muted-foreground">
            共检测到 {data.headers.length} 列，{data.totalRows} 行数据
          </p>

          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {data.headers.map((header, i) => (
                    <th key={i} className="text-left p-2 font-medium whitespace-nowrap">
                      {header}
                      <br />
                      <span className="text-xs font-normal">
                        {typeBadge(data.suggestedTypes[i]?.detectedType || "STRING")}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.sampleRows.slice(0, 5).map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b last:border-0 hover:bg-muted/30">
                    {row.map((cell: unknown, colIdx: number) => (
                      <td key={colIdx} className="p-2 text-muted-foreground truncate max-w-[200px]">
                        {String(cell || "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={onBack}>
              返回
            </Button>
            <Button
              onClick={() =>
                onConfirm(data.headers, data.suggestedTypes, data.totalRows)
              }
              disabled={isLoading}
            >
              下一步：字段映射
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
