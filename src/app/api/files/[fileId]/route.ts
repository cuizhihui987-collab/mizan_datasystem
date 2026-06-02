import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { deleteFileRecord } from "@/lib/storage";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { fileId } = await params;
  const file = await prisma.storedFile.findUnique({ where: { id: fileId } });

  if (!file) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }

  return NextResponse.json(file);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { fileId } = await params;
  const body = await req.json();
  const file = await prisma.storedFile.findUnique({ where: { id: fileId } });
  if (!file) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.tags !== undefined) {
    updateData.tags = JSON.stringify(body.tags);
  }
  if (body.folder !== undefined) {
    updateData.folder = body.folder;
  }

  await prisma.storedFile.update({ where: { id: fileId }, data: updateData });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { fileId } = await params;
  const file = await prisma.storedFile.findUnique({ where: { id: fileId } });

  if (!file) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }

  await deleteFileRecord(fileId);

  return NextResponse.json({ success: true });
}
