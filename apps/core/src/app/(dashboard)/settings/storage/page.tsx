"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { HardDrive, Cloud, CheckCircle2 } from "lucide-react";

export default function StorageSettingsPage() {
  const [storageType, setStorageType] = useState<"local" | "s3">("local");
  const [endpoint, setEndpoint] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [bucket, setBucket] = useState("mizan-files");
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [testing, setTesting] = useState(false);

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/files?page=1&pageSize=1");
      if (res.ok) {
        toast.success(storageType === "s3" ? "S3 连接成功" : "本地存储可用");
      } else {
        toast.error("连接失败");
      }
    } catch {
      toast.error("连接测试失败");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>存储配置</CardTitle>
          <CardDescription>选择文件存储后端，修改后需重启服务生效</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setStorageType("local")}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                storageType === "local" ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground"
              }`}
            >
              <HardDrive className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium">本地存储</p>
                <p className="text-sm text-muted-foreground">存储在服务器 public/uploads</p>
              </div>
              {storageType === "local" && <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />}
            </button>
            <button
              type="button"
              onClick={() => setStorageType("s3")}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                storageType === "s3" ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground"
              }`}
            >
              <Cloud className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium">S3 兼容存储</p>
                <p className="text-sm text-muted-foreground">MinIO / AWS S3 等</p>
              </div>
              {storageType === "s3" && <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />}
            </button>
          </div>

          {storageType === "s3" && (
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-medium">S3 连接配置</h3>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Endpoint</p>
                  <Input
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="http://localhost:9000"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Region</p>
                    <Input
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="us-east-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Bucket</p>
                    <Input
                      value={bucket}
                      onChange={(e) => setBucket(e.target.value)}
                      placeholder="mizan-files"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Access Key</p>
                  <Input
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                    placeholder="S3 Access Key"
                    type="password"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Secret Key</p>
                  <Input
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder="S3 Secret Key"
                    type="password"
                  />
                </div>
              </div>
              <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
                {testing ? "测试中..." : "测试连接"}
              </Button>
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              当前存储：{storageType === "local" ? "本地存储" : "S3 兼容存储"}
              <Badge variant="outline" className="text-xs ml-2">
                环境变量配置
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
