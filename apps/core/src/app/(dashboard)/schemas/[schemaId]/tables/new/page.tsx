"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";

export default function NewTablePage() {
  const params = useParams();
  const router = useRouter();
  const [logicalName, setLogicalName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/schemas/${params.schemaId}/tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logicalName, description }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push(`/schemas/${params.schemaId}/tables/${data.id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </Button>
        <div>
          <h1 className="text-3xl font-bold">新建数据表</h1>
          <p className="text-muted-foreground mt-1">定义表的基本信息，稍后可以在 DDL 设计器中配置详细结构</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">表名称</label>
              <Input
                value={logicalName}
                onChange={(e) => setLogicalName(e.target.value)}
                placeholder="例如: 商品信息"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">描述（可选）</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="表的用途说明"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => router.back()}>
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "创建中..." : "创建并进入设计"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
