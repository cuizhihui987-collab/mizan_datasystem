import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { PipelineEngine } from "@/lib/pipeline/pipeline-engine";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ schemaId: string; pipelineId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { schemaId, pipelineId } = await params;

  const pipeline = await prisma.pipelineDefinition.findFirst({
    where: { id: pipelineId, schema: { id: schemaId, userId: session.user.id } },
  });
  if (!pipeline) {
    return NextResponse.json({ error: "Pipeline 不存在" }, { status: 404 });
  }

  if (pipeline.status === "RUNNING") {
    return NextResponse.json(
      { error: "Pipeline 正在执行中" },
      { status: 409 }
    );
  }

  const engine = new PipelineEngine();
  const result = await engine.execute(pipelineId);

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
