"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StepUpload } from "./step-upload";
import { StepParsePreview } from "./step-parse-preview";
import { StepColumnMapping, type ColumnMapping } from "./step-column-mapping";
import { Check, Upload, Table, ListOrdered } from "lucide-react";
import { cn } from "@mizan/shared-lib/utils";

interface ImportWizardProps {
  schemaId: string;
}

interface ParseData {
  headers: string[];
  suggestedTypes: Array<{
    columnIndex: number;
    columnName: string;
    detectedType: string;
    confidence: number;
    nullCount: number;
  }>;
  totalRows: number;
}

type Step = "upload" | "parse" | "mapping" | "done";

const steps = [
  { id: "upload" as Step, label: "上传文件", icon: Upload },
  { id: "parse" as Step, label: "解析数据", icon: Table },
  { id: "mapping" as Step, label: "字段映射", icon: ListOrdered },
  { id: "done" as Step, label: "完成", icon: Check },
];

export function ImportWizard({ schemaId }: ImportWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("upload");
  const [importId, setImportId] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseData, setParseData] = useState<ParseData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleUploadComplete = (id: string, name: string) => {
    setImportId(id);
    setFileName(name);
    setCurrentStep("parse");
  };

  const handleParseComplete = (
    headers: string[],
    suggestedTypes: ParseData["suggestedTypes"],
    totalRows: number
  ) => {
    setParseData({ headers, suggestedTypes, totalRows });
    setCurrentStep("mapping");
  };

  const handleMappingConfirm = async (
    columns: ColumnMapping[],
    tableName: string
  ) => {
    if (!importId || !parseData) return;
    setIsCreating(true);
    setCreateError(null);

    const createTable = async (name: string): Promise<{ id: string } | null> => {
      const res = await fetch(`/api/schemas/${schemaId}/tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logicalName: name,
          headerRowNumber: 1,
          sourceFile: fileName,
          columns: columns.map((col) => ({
            sourceName: col.sourceName,
            logicalName: col.logicalName,
            dataType: col.dataType,
            isPrimaryKey: col.isPrimaryKey,
            isNullable: col.isNullable,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) return data;
      if (res.status === 409) return null; // name conflict
      throw new Error(data.error || "创建失败");
    };

    try {
      // Try the original name first
      let table = await createTable(tableName);

      // If name conflicts, auto-retry with numbered suffix
      if (!table) {
        for (let i = 2; i <= 100; i++) {
          table = await createTable(`${tableName} (${i})`);
          if (table) break;
        }
      }

      if (!table) {
        setCreateError(`无法创建表：表名 "${tableName}" 已存在，自动重命名均失败`);
        setIsCreating(false);
        return;
      }

      await fetch(`/api/imports/${importId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: table.id }),
      });

      setCurrentStep("done");
      setTimeout(() => {
        router.push(`/schemas/${schemaId}/tables/${table.id}/ddl-designer`);
      }, 1000);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "创建表失败");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-center gap-2 shrink-0">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors whitespace-nowrap",
                currentStep === step.id
                  ? "bg-primary text-primary-foreground"
                  : steps.findIndex((s) => s.id === currentStep) > idx
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <step.icon className="h-4 w-4" />
              <span>{step.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "h-px w-12 shrink-0",
                  steps.findIndex((s) => s.id === currentStep) > idx
                    ? "bg-primary"
                    : "bg-muted"
                )}
              />
            )}
          </div>
        ))}
      </div>

      <Card className="flex flex-col max-h-[calc(100vh-12rem)]">
        <CardHeader className="shrink-0">
          <CardTitle>
            {currentStep === "upload" && "上传文件"}
            {currentStep === "parse" && `解析 - ${fileName}`}
            {currentStep === "mapping" && "字段映射"}
            {currentStep === "done" && "创建成功"}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-y-auto min-h-0">
          {currentStep === "upload" && (
            <StepUpload
              schemaId={schemaId}
              onUploadComplete={handleUploadComplete}
            />
          )}
          {currentStep === "parse" && importId && (
            <StepParsePreview
              importId={importId}
              onConfirm={handleParseComplete}
              onBack={() => setCurrentStep("upload")}
            />
          )}
          {currentStep === "mapping" && parseData && (
            <>
              {createError && (
                <Card className="border-destructive bg-destructive/10">
                  <CardContent className="p-3 text-sm text-destructive">
                    {createError}
                  </CardContent>
                </Card>
              )}
              <StepColumnMapping
                headers={parseData.headers}
                suggestedTypes={parseData.suggestedTypes}
                onConfirm={handleMappingConfirm}
                onBack={() => setCurrentStep("parse")}
                defaultTableName={parseData.headers[0] || "未命名表"}
              />
            </>
          )}
          {currentStep === "done" && (
            <div className="py-12 text-center space-y-4">
              <Check className="h-16 w-16 mx-auto text-green-500" />
              <p className="text-lg font-medium">
                {isCreating ? "正在创建..." : "表创建成功，正在进入 DDL 设计器..."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
