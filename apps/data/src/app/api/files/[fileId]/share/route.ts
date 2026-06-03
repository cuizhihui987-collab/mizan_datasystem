import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { fileId } = await params;
  const { userId: targetUserId } = await req.json();
  if (!targetUserId) {
    return NextResponse.json({ error: "请选择要分享的用户" }, { status: 400 });
  }

  const file = await prisma.storedFile.findUnique({ where: { id: fileId } });
  if (!file) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }

  // Only owner can share
  if (file.userId !== session.user.id) {
    return NextResponse.json({ error: "只能分享自己的文件" }, { status: 403 });
  }

  // Check target user exists
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  // Update sharedWith
  const sharedWith: string[] = file.sharedWith ? JSON.parse(file.sharedWith) : [];
  if (!sharedWith.includes(targetUserId)) {
    sharedWith.push(targetUserId);
  }
  await prisma.storedFile.update({
    where: { id: fileId },
    data: { sharedWith: JSON.stringify(sharedWith) },
  });

  // Create notification
  const sharerName = session.user.name || session.user.email || "某用户";
  await prisma.notification.create({
    data: {
      userId: targetUserId,
      type: "file_shared",
      title: "文件分享",
      message: `${sharerName} 分享了文件「${file.originalName}」给你`,
      link: `/files`,
    },
  });

  return NextResponse.json({ success: true });
}
