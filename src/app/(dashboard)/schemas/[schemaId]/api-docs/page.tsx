"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Code, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
  parameters?: { query?: Array<{ name: string; type: string; description: string }> };
  requestBody?: Record<string, unknown>;
  example?: string;
  response?: string;
}

interface ApiDocs {
  schema: { id: string; name: string; description: string | null };
  baseUrl: string;
  endpoints: Array<{
    table: { id: string; logicalName: string; physicalName: string; status: string };
    columns: Array<{ name: string; field: string; type: string; required: boolean; primaryKey: boolean }>;
    api: Record<string, ApiEndpoint>;
  }>;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400",
  POST: "text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400",
  PUT: "text-orange-600 bg-orange-50 dark:bg-orange-950 dark:text-orange-400",
  DELETE: "text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="text-muted-foreground hover:text-foreground shrink-0"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("已复制");
        setTimeout(() => setCopied(false), 1500);
      }}
      title="复制"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function ApiDocsPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTable, setActiveTable] = useState<string>("");

  const { data: docs, isLoading } = useQuery<ApiDocs>({
    queryKey: ["api-docs", params.schemaId],
    queryFn: () => fetch(`/api/schemas/${params.schemaId}/api-docs`).then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!docs) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">无法加载 API 文档</p>
      </div>
    );
  }

  const activeEndpoint = activeTable || docs.endpoints[0]?.table.id || "";
  const current = docs.endpoints.find((e) => e.table.id === activeEndpoint);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </Button>
        <div>
          <h1 className="text-3xl font-bold">API 文档</h1>
          <p className="text-muted-foreground mt-1">{docs.schema.name} — 自动生成</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-1">
          <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">数据表</p>
          {docs.endpoints.map((ep) => (
            <button
              key={ep.table.id}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                activeEndpoint === ep.table.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted text-muted-foreground"
              }`}
              onClick={() => setActiveTable(ep.table.id)}
            >
              {ep.table.logicalName}
              <span className="text-xs ml-1 opacity-60">({ep.columns.length} 字段)</span>
            </button>
          ))}
          <div className="pt-4">
            <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">基础地址</p>
            <code className="text-xs bg-muted block rounded px-2 py-1.5 break-all">{docs.baseUrl}</code>
          </div>
        </div>

        {/* Main content */}
        <div className="lg:col-span-3 space-y-4">
          {!current ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">选择数据表查看 API</CardContent>
            </Card>
          ) : (
            <>
              {/* Table info */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{current.table.logicalName}</CardTitle>
                    <Badge variant={current.table.status === "CREATED" ? "success" : "secondary"}>
                      {current.table.status === "CREATED" ? "已创建" : "草稿"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{current.table.physicalName}</p>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium mb-2">字段定义 ({current.columns.length})</div>
                  <div className="overflow-x-auto border rounded-md">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-2 font-medium">逻辑名</th>
                          <th className="text-left p-2 font-medium">字段名</th>
                          <th className="text-left p-2 font-medium">类型</th>
                          <th className="text-center p-2 font-medium">必填</th>
                          <th className="text-center p-2 font-medium">主键</th>
                        </tr>
                      </thead>
                      <tbody>
                        {current.columns.map((col) => (
                          <tr key={col.field} className="border-b last:border-0">
                            <td className="p-2">{col.name}</td>
                            <td className="p-2 font-mono">{col.field}</td>
                            <td className="p-2"><Badge variant="outline">{col.type}</Badge></td>
                            <td className="p-2 text-center">{col.required ? "✓" : ""}</td>
                            <td className="p-2 text-center">{col.primaryKey ? "✓" : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* API Endpoints */}
              {Object.entries(current.api).map(([key, endpoint]) => (
                <Card key={key}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={`font-mono text-[10px] ${METHOD_COLORS[endpoint.method] || ""}`}>
                          {endpoint.method}
                        </Badge>
                        <code className="text-sm font-mono">{endpoint.path}</code>
                        <CopyButton text={`${endpoint.method} ${endpoint.path}`} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{endpoint.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Query parameters */}
                    {!!endpoint.parameters?.query?.length && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">查询参数</p>
                        <div className="overflow-x-auto border rounded-md">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="text-left p-1.5 font-medium">参数</th>
                                <th className="text-left p-1.5 font-medium">类型</th>
                                <th className="text-left p-1.5 font-medium">说明</th>
                              </tr>
                            </thead>
                            <tbody>
                              {endpoint.parameters!.query!.map((p) => (
                                <tr key={p.name} className="border-b last:border-0">
                                  <td className="p-1.5 font-mono">{p.name}</td>
                                  <td className="p-1.5 text-muted-foreground">{p.type}</td>
                                  <td className="p-1.5">{p.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Request body */}
                    {!!endpoint.requestBody && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">请求体</p>
                        <div className="relative">
                          <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto max-h-48">
                            {JSON.stringify(endpoint.requestBody, null, 2)}
                          </pre>
                          <CopyButton text={JSON.stringify(endpoint.requestBody, null, 2)} />
                        </div>
                      </div>
                    )}

                    {/* Example */}
                    {!!endpoint.example && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">示例</p>
                        <code className="text-xs bg-muted block rounded-md p-2 break-all">{endpoint.example}</code>
                      </div>
                    )}

                    {/* Response */}
                    {!!endpoint.response && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">返回</p>
                        <code className="text-xs bg-muted block rounded-md p-2 font-mono">{endpoint.response}</code>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {/* curl examples */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">CURL 示例</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">查询数据</p>
                    <div className="relative">
                      <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto">
                        {`curl "${docs.baseUrl}/api/tables/${current.table.id}/data?page=1&pageSize=10" \\\n  -H "Content-Type: application/json"`}
                      </pre>
                      <CopyButton text={`curl "${docs.baseUrl}/api/tables/${current.table.id}/data?page=1&pageSize=10" -H "Content-Type: application/json"`} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">插入数据</p>
                    <div className="relative">
                      <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto">
                        {`curl -X POST "${docs.baseUrl}/api/tables/${current.table.id}/data" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(
                          current.columns.slice(0, 3).reduce((acc, c) => {
                            acc[c.field] = `示例${c.name}`;
                            return acc;
                          }, {} as Record<string, string>)
                        )}'`}
                      </pre>
                      <CopyButton text={`curl -X POST "${docs.baseUrl}/api/tables/${current.table.id}/data" -H "Content-Type: application/json" -d '{}'`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
