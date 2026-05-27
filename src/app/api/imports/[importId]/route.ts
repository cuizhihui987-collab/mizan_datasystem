import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { unlink } from "fs/promises";
import path from "path";

export async function GET(
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
    include: {
      table: { select: { logicalName: true, physicalName: true } },
      schema: { select: { name: true } },
    },
  });

  if (!importJob) {
    return NextResponse.json({ error: "导入记录不存在" }, { status: 404 });
  }

  return NextResponse.json(importJob);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ importId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { importId } = await params;
  const body = await req.json();

  const importJob = await prisma.importJob.findFirst({
    where: { id: importId, schema: { userId: session.user.id } },
  });

  if (!importJob) {
    return NextResponse.json({ error: "导入记录不存在" }, { status: 404 });
  }

  const updated = await prisma.importJob.update({
    where: { id: importId },
    data: {
      ...(body.tableId ? { tableId: body.tableId } : {}),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
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
  });

  if (!importJob) {
    return NextResponse.json({ error: "导入记录不存在" }, { status: 404 });
  }

  // Clean up file
  try {
    const filePath = path.join(process.cwd(), "public", importJob.filePath);
    await unlink(filePath);
  } catch {
    // File may not exist, ignore
  }

  await prisma.importJob.delete({ where: { id: importId } });

  return NextResponse.json({ success: true });
}
