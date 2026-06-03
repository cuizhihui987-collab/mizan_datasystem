"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play, Plus, Save, Loader2, Trash2, ArrowLeft } from "lucide-react";
import { PipelineStepCard } from "@/components/pipeline/pipeline-step-card";
import { AddStepDialog } from "@/components/pipeline/add-step-dialog";
import { StepConfigDialog } from "@/components/pipeline/step-config-dialog";
import { PipelineExecutionProgress } from "@/components/pipeline/pipeline-execution-progress";

interface StepResult {
  stepId: string;
  stepLabel: string;
  status: string;
  affectedRows?: number;
  errorMessage?: string;
  outputTable?: string;
}

interface StepData {
  id: string;
  stepOrder: number;
  stepType: string;
  label: string | null;
  config: string;
  sourceTableId: string | null;
  outputPhysicalName: string;
  status: string;
  errorLog: string | null;
}

export function PipelineBuilder({
  schemaId,
  pipelineId,
}: {
  schemaId: string;
  pipelineId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAddStep, setShowAddStep] = useState(false);
  const [editingStep, setEditingStep] = useState<{ index: number; type: string; config: Record<string, unknown> } | null>(null);
  const [steps, setSteps] = useState<StepData[]>([]);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [executionResults, setExecutionResults] = useState<StepResult[] | null>(null);
  const [executing, setExecuting] = useState(false);

  // Load pipeline
  const { data: pipeline, isLoading } = useQuery({
    queryKey: ["pipeline", pipelineId],
    queryFn: async () => {
      const res = await fetch(`/api/schemas/${schemaId}/pipelines/${pipelineId}`);
      if (!res.ok) throw new Error("加载失败");
      return res.json() as Promise<{
        id: string;
        name: string;
        description: string | null;
        status: string;
        steps: StepData[];
      }>;
    },
  });

  useEffect(() => {
    if (pipeline?.steps) {
      setSteps(pipeline.steps);
    }
  }, [pipeline?.steps]);

  // Save pipeline name
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/schemas/${schemaId}/pipelines/${pipelineId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      if (!res.ok) throw new Error("保存失败");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", pipelineId] });
      toast.success("已保存");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "保存失败");
    },
  });

  // Execute pipeline
  const executePipeline = async () => {
    setExecuting(true);
    setExecutionOpen(true);
    setExecutionResults(null);

    // First API call to start execution
    const res = await fetch(`/api/schemas/${schemaId}/pipelines/${pipelineId}/execute`, {
      method: "POST",
    });

    if (!res.ok) {
      const err = await res.json();
      setExecutionResults(err.stepResults || []);
      setExecuting(false);
      toast.error(err.error || "执行失败");
      return;
    }

    const result = await res.json();
    setExecutionResults(result.stepResults || []);
    setExecuting(false);
    queryClient.invalidateQueries({ queryKey: ["pipeline", pipelineId] });

    if (result.success) {
      toast.success("Pipeline 执行完成");
    } else {
      toast.error("Pipeline 执行失败");
    }
  };

  // Add step
  const addStepMutation = useMutation({
    mutationFn: async (data: { stepType: string; label: string }) => {
      const res = await fetch(`/api/schemas/${schemaId}/pipelines/${pipelineId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "添加失败");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", pipelineId] });
      setShowAddStep(false);
      toast.success("步骤已添加");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "添加失败");
    },
  });

  // Delete step
  const deleteStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      const res = await fetch(`/api/schemas/${schemaId}/pipelines/${pipelineId}/steps/${stepId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", pipelineId] });
      toast.success("步骤已删除");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "删除失败");
    },
  });

  // Update step config
  const updateStepMutation = useMutation({
    mutationFn: async ({ stepId, data }: { stepId: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/schemas/${schemaId}/pipelines/${pipelineId}/steps/${stepId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("保存失败");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", pipelineId] });
      toast.success("步骤配置已保存");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "保存失败");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!pipeline) {
    return <div className="text-center py-12 text-muted-foreground">Pipeline 不存在</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/schemas/${schemaId}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
          <div>
            <h2 className="text-xl font-bold">{pipeline.name}</h2>
            {pipeline.description && (
              <p className="text-sm text-muted-foreground">{pipeline.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            保存
          </Button>
          <Button
            onClick={executePipeline}
            disabled={steps.length === 0 || executing}
          >
            {executing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            执行
          </Button>
        </div>
      </div>

      {/* Steps list */}
      <div className="space-y-2">
        {steps.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">尚未添加任何步骤</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              点击下方按钮添加数据源和处理步骤
            </p>
          </div>
        ) : (
          steps.map((step, idx) => (
            <PipelineStepCard
              key={step.id}
              step={{
                stepOrder: step.stepOrder,
                stepType: step.stepType,
                label: step.label || "",
                config: JSON.parse(step.config || "{}"),
                sourceTableId: step.sourceTableId || undefined,
              }}
              index={idx}
              status={step.status}
              onEdit={() =>
                setEditingStep({
                  index: idx,
                  type: step.stepType,
                  config: JSON.parse(step.config || "{}"),
                })
              }
              onDelete={() => {
                if (confirm("确定删除此步骤？")) {
                  deleteStepMutation.mutate(step.id);
                }
              }}
            />
          ))
        )}

        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={() => setShowAddStep(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          添加步骤
        </Button>
      </div>

      {/* Delete pipeline */}
      <div className="pt-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={async () => {
            if (!confirm("确定删除此 Pipeline？所有中间表将被清理。")) return;
            const res = await fetch(`/api/schemas/${schemaId}/pipelines/${pipelineId}`, {
              method: "DELETE",
            });
            if (res.ok) {
              toast.success("Pipeline 已删除");
              router.push(`/schemas/${schemaId}`);
            } else {
              toast.error("删除失败");
            }
          }}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          删除 Pipeline
        </Button>
      </div>

      {/* Dialogs */}
      <AddStepDialog
        open={showAddStep}
        onOpenChange={setShowAddStep}
        onConfirm={(stepType, label) =>
          addStepMutation.mutate({ stepType, label })
        }
      />

      {editingStep && (
        <StepConfigDialog
          open={!!editingStep}
          onOpenChange={(open) => {
            if (!open) setEditingStep(null);
          }}
          stepType={editingStep.type}
          config={editingStep.config}
          schemaId={schemaId}
          prevStepPhysicalName={
            editingStep.index > 0
              ? steps[editingStep.index - 1]?.outputPhysicalName
              : undefined
          }
          onSave={(config) => {
            const step = steps[editingStep.index];
            updateStepMutation.mutate({
              stepId: step.id,
              data: { config },
            });
          }}
        />
      )}

      <PipelineExecutionProgress
        open={executionOpen}
        onOpenChange={setExecutionOpen}
        results={executionResults}
        running={executing}
      />
    </div>
  );
}
