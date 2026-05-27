import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { DataImporter } from "@/lib/import/data-importer";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ importId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { importId } = await params;

  const importJob = await prisma.importJob.findFirst({
    where: { id: importId, schema: { userId: session.user.id } },
    include: { table: true },
  });

  if (!importJob) {
    return NextResponse.json({ error: "导入记录不存在" }, { status: 404 });
  }

  if (!importJob.table) {
    return NextResponse.json(
      { error: "请先关联数据表" },
      { status: 400 }
    );
  }

  if (importJob.status !== "PENDING") {
    return NextResponse.json(
      { error: "导入任务已开始或已完成" },
      { status: 409 }
    );
  }

  // Start async import (non-blocking - fire and forget)
  const importer = new DataImporter();
  importer.import(importId).catch((err) => {
    console.error("Import error:", err);
  });

  return NextResponse.json({ status: "processing" });
}
