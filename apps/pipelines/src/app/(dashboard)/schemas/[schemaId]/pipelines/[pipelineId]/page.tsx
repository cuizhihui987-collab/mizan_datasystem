"use client";

import { useParams } from "next/navigation";
import { WorkflowPipelineBuilder } from "@/components/pipeline/workflow-pipeline-builder";

export default function PipelineEditorPage() {
  const params = useParams();
  const schemaId = params.schemaId as string;
  const pipelineId = params.pipelineId as string;

  return <WorkflowPipelineBuilder schemaId={schemaId} pipelineId={pipelineId} />;
}
