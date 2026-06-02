import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  const guard = await requireAdmin(session);
  if (guard) return guard;

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      roles: {
        include: {
          role: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json(users);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const guard = await requireAdmin(session);
  if (guard) return guard;

  const body = await req.json();
  const { userId, roleIds } = body;

  if (!userId || !Array.isArray(roleIds)) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  // Prevent removing own admin
  if (userId === session!.user!.id && (!roleIds.length || !await prisma.role.findFirst({
    where: { id: { in: roleIds }, name: "超级管理员" },
  }))) {
    return NextResponse.json({ error: "不能移除自己的管理员角色" }, { status: 400 });
  }

  // Delete existing role assignments and create new ones
  await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId } });

    for (const roleId of roleIds) {
      await tx.userRole.create({ data: { userId, roleId } });
    }

    // Update legacy role field for backward compatibility
    const hasAdminRole = await tx.role.findFirst({
      where: { id: { in: roleIds }, name: "超级管理员" },
    });
    await tx.user.update({
      where: { id: userId },
      data: { role: hasAdminRole ? "ADMIN" : "USER" },
    });
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const guard = await requireAdmin(session);
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "缺少 userId 参数" }, { status: 400 });
  }

  // Cannot delete yourself
  if (userId === session!.user!.id) {
    return NextResponse.json({ error: "不能删除自己" }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除用户失败:", error);
    return NextResponse.json({ error: "删除用户失败" }, { status: 500 });
  }
}
