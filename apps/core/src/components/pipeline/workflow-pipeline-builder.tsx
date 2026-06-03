"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { WorkflowCanvas } from "./canvas/workflow-canvas";
import { StepConfigDialog } from "./step-config-dialog";
import { usePipelineStore } from "@/stores/pipeline-store";
import { Button } from "@/components/ui/button";
import { PipelineStepCard } from "./pipeline-step-card";
import { useRouter } from "next/navigation";
import type { PipelineDefinition } from "@/lib/pipeline/pipeline-converter";
import type { PipelineNodeData } from "@/lib/pipeline/pipeline-converter";

interface StepData {
  id: string;
  stepOrder: number;
  stepType: string;
  label: string | null;
  config: string;
  sourceTableId: string | null;
  outputPhysicalName: string;
  status: string;
}

export function WorkflowPipelineBuilder({
  schemaId,
  pipelineId,
}: {
  schemaId: string;
  pipelineId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const store = usePipelineStore();

  // ── Dialog state ──
  const [editingStep, setEditingStep] = useState<{
    stepId: string;
    type: string;
    config: Record<string, unknown>;
  } | null>(null);

  // ── Load pipeline ──
  const { data: pipeline, isLoading } = useQuery({
    queryKey: ["pipeline", pipelineId],
    queryFn: async () => {
      const res = await fetch(`/api/schemas/${schemaId}/pipelines/${pipelineId}`);
      if (!res.ok) throw new Error("加载失败");
      return res.json() as Promise<PipelineDefinition>;
    },
  });

  useEffect(() => {
    if (pipeline) {
      store.loadPipeline(pipeline);
      // 注入右键菜单回调到节点数据
      const nodes = store.nodes.map((n: any) => ({
        ...n,
        data: { ...n.data, onEdit: () => handleOpenNodeConfig(n.data), onDelete: () => handleDeleteNode(n.data.stepId) },
      }));
      store.setNodes(nodes);
    }
  }, [pipeline]);

  // ── Save ──
  const saveMutation = useMutation({
    mutationFn: async (edgesJson: string) => {
      const res = await fetch(`/api/schemas/${schemaId}/pipelines/${pipelineId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edges: edgesJson }),
      });
      if (!res.ok) throw new Error("保存失败");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", pipelineId] });
      store.setDirty(false);
      toast.success("已保存");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "保存失败"),
  });

  const handleSave = useCallback(() => {
    saveMutation.mutate(JSON.stringify(store.edges));
  }, [store.edges, saveMutation]);

  // ── Execute ──
  const executeMutation = useMutation({
    mutationFn: async () => {
      store.setExecuting(true);
      const res = await fetch(`/api/schemas/${schemaId}/pipelines/${pipelineId}/execute`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "执行失败");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", pipelineId] });
      toast.success("Pipeline 执行完成");
      store.setExecuting(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "执行失败");
      store.setExecuting(false);
    },
  });

  // ── Mutations ──
  const updateStepMutation = useMutation({
    mutationFn: async ({ stepId, data }: { stepId: string; data: Record<string, unknown> }) => {
      const res = await fetch(
        `/api/schemas/${schemaId}/pipelines/${pipelineId}/steps/${stepId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) throw new Error("更新失败");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pipeline", pipelineId] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "更新失败"),
  });

  const addStepMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/schemas/${schemaId}/pipelines/${pipelineId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("添加失败");
      return res.json() as Promise<StepData>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", pipelineId] });
      toast.success("步骤已添加");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "添加失败"),
  });

  const deleteStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      const res = await fetch(
        `/api/schemas/${schemaId}/pipelines/${pipelineId}/steps/${stepId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("删除失败");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline", pipelineId] });
      toast.success("步骤已删除");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "删除失败"),
  });

  // ── Canvas handlers ──
  const handleDropNode = useCallback(
    (type: string, position: { x: number; y: number }) => {
      addStepMutation.mutate({ stepType: type, label: type, config: { _nodePosition: position } });
    },
    [addStepMutation]
  );

  const handleOpenNodeConfig = useCallback((nodeData: PipelineNodeData) => {
    setEditingStep({ stepId: nodeData.stepId, type: nodeData.stepType, config: nodeData.config });
  }, []);

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (confirm("确定删除此步骤？")) deleteStepMutation.mutate(nodeId);
    },
    [deleteStepMutation]
  );

  const handleNodeLabelChange = useCallback(
    (nodeId: string, label: string) => {
      updateStepMutation.mutate({ stepId: nodeId, data: { label } });
    },
    [updateStepMutation]
  );

  const handleConnect = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (connection: any) => {
      const edgeId = `e-${connection.source}-${connection.target}-${connection.sourceHandle || "out"}-${connection.targetHandle || "in"}-${Date.now()}`;
      store.setEdges([...store.edges, { id: edgeId, ...connection, type: "animated", animated: true }]);
    },
    [store.edges, store.setEdges]
  );

  // ── Unpack store values for re-renders ──
  const { nodes, edges, isDirty, isExecuting, viewMode, setViewMode } = store;

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

  // ── List view (backward compat) ──
  if (viewMode === "list" && pipeline?.steps) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/schemas/${schemaId}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" />返回
          </Button>
          <h2 className="text-xl font-bold">{pipeline?.name}</h2>
          <Button variant="outline" size="sm" onClick={() => setViewMode("canvas")}>
            切换到画布视图
          </Button>
        </div>
        <div className="space-y-2">
          {pipeline.steps.map((step, idx) => (
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
                setEditingStep({ stepId: step.id, type: step.stepType, config: JSON.parse(step.config || "{}") })
              }
              onDelete={() => {
                if (confirm("确定删除？")) deleteStepMutation.mutate(step.id);
              }}
            />
          ))}
        </div>

        {editingStep && (
          <StepConfigDialog
            open={!!editingStep}
            onOpenChange={(open) => !open && setEditingStep(null)}
            stepType={editingStep.type}
            config={editingStep.config}
            schemaId={schemaId}
            onSave={(config) => {
              updateStepMutation.mutate({ stepId: editingStep.stepId, data: { config } });
              setEditingStep(null);
            }}
          />
        )}
      </div>
    );
  }

  // ── Canvas view ──
  return (
    <div className="h-[calc(100vh-8rem)]">
      <WorkflowCanvas
        nodes={nodes}
        edges={edges}
        pipelineName={store.pipelineName}
        isDirty={isDirty}
        isExecuting={isExecuting}
        viewMode={viewMode}
        onNodesChange={() => {}}
        onEdgesChange={() => {}}
        onConnect={handleConnect}
        onSave={handleSave}
        onExecute={() => executeMutation.mutate()}
        onToggleView={() => setViewMode(viewMode === "canvas" ? "list" : "canvas")}
        onDeleteNode={handleDeleteNode}
        onOpenNodeConfig={handleOpenNodeConfig}
        onNodeLabelChange={handleNodeLabelChange}
        onDropNode={handleDropNode}
      />

      {editingStep && (
        <StepConfigDialog
          open={!!editingStep}
          onOpenChange={(open) => !open && setEditingStep(null)}
          stepType={editingStep.type}
          config={editingStep.config}
          schemaId={schemaId}
          onSave={(config) => {
            updateStepMutation.mutate({ stepId: editingStep.stepId, data: { config } });
            setEditingStep(null);
          }}
        />
      )}
    </div>
  );
}
