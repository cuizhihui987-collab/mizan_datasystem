"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StepUpload } from "./step-upload";
import { StepParsePreview } from "./step-parse-preview";
import { Check, Upload, Table } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportWizardProps {
  schemaId: string;
}

type Step = "upload" | "parse" | "done";

const steps = [
  { id: "upload" as Step, label: "上传文件", icon: Upload },
  { id: "parse" as Step, label: "解析数据", icon: Table },
  { id: "done" as Step, label: "完成", icon: Check },
];

export function ImportWizard({ schemaId }: ImportWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("upload");
  const [importId, setImportId] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  const handleUploadComplete = (id: string, name: string) => {
    setImportId(id);
    setFileName(name);
    setCurrentStep("parse");
  };

  const handleConfirm = async (tableName: string, headerRow: number) => {
    if (!importId) return;

    try {
      // Create table definition from parsed data
      const res = await fetch(`/api/schemas/${schemaId}/tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logicalName: tableName,
          headerRowNumber: headerRow,
          sourceFile: fileName,
        }),
      });

      const table = await res.json();

      if (res.ok) {
        // Link import job to table
        await fetch(`/api/imports/${importId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableId: table.id }),
        });

        setCurrentStep("done");
        // Navigate to table DDL designer
        setTimeout(() => {
          router.push(`/schemas/${schemaId}/tables/${table.id}/ddl-designer`);
        }, 1000);
      }
    } catch (err) {
      console.error("Failed to create table:", err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors",
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
                  "h-px w-12",
                  steps.findIndex((s) => s.id === currentStep) > idx
                    ? "bg-primary"
                    : "bg-muted"
                )}
              />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {currentStep === "upload" && "上传文件"}
            {currentStep === "parse" && `解析 - ${fileName}`}
            {currentStep === "done" && "创建成功"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentStep === "upload" && (
            <StepUpload
              schemaId={schemaId}
              onUploadComplete={handleUploadComplete}
            />
          )}
          {currentStep === "parse" && importId && (
            <StepParsePreview
              importId={importId}
              onConfirm={handleConfirm}
              onBack={() => setCurrentStep("upload")}
            />
          )}
          {currentStep === "done" && (
            <div className="py-12 text-center space-y-4">
              <Check className="h-16 w-16 mx-auto text-green-500" />
              <p className="text-lg font-medium">表创建成功，正在进入 DDL 设计器...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
