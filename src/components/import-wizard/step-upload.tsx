"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileSpreadsheet, X } from "lucide-react";

interface StepUploadProps {
  schemaId: string;
  onUploadComplete: (importId: string, fileName: string) => void;
}

export function StepUpload({ schemaId, onUploadComplete }: StepUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleUpload = useCallback(async () => {
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("schemaId", schemaId);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "上传失败");
      }

      onUploadComplete(data.importId, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }, [file, schemaId, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const ext = droppedFile.name.split(".").pop()?.toLowerCase();
      if (!["xlsx", "xls", "csv"].includes(ext || "")) {
        setError("仅支持 .xlsx、.xls、.csv 格式");
        return;
      }
      if (droppedFile.size > 50 * 1024 * 1024) {
        setError("文件大小不能超过 50MB");
        return;
      }
      setError("");
      setFile(droppedFile);
    }
  }, []);

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
          ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
          ${file ? "bg-muted/50" : "hover:bg-muted/50"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !file && document.getElementById("file-input")?.click()}
      >
        {file ? (
          <div className="space-y-2">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-primary" />
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                setError("");
              }}
            >
              <X className="h-4 w-4 mr-1" />
              重新选择
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="font-medium">拖拽文件到此处或点击上传</p>
            <p className="text-sm text-muted-foreground">
              支持 .xlsx、.xls、.csv 格式，最大 50MB
            </p>
          </div>
        )}
        <input
          id="file-input"
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const selectedFile = e.target.files?.[0];
            if (selectedFile) {
              if (selectedFile.size > 50 * 1024 * 1024) {
                setError("文件大小不能超过 50MB");
                return;
              }
              setError("");
              setFile(selectedFile);
            }
          }}
        />
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-3 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? "上传中..." : "上传并解析"}
        </Button>
      </div>
    </div>
  );
}
