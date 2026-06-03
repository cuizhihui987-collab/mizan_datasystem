"use client";

import { useParams } from "next/navigation";
import { PipelineBuilder } from "@/components/pipeline/pipeline-builder";

export default function PipelineEditorPage() {
  const params = useParams();
  const schemaId = params.schemaId as string;
  const pipelineId = params.pipelineId as string;

  return <PipelineBuilder schemaId={schemaId} pipelineId={pipelineId} />;
}
