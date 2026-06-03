import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";
import { requireAdmin } from "@mizan/shared-lib/auth/permissions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const session = await getServerSession(authOptions);
  const guard = await requireAdmin(session);
  if (guard) return guard;

  const { roleId } = await params;

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: {
      permissions: {
        include: { permission: true },
      },
      _count: { select: { users: true } },
    },
  });

  if (!role) {
    return NextResponse.json({ error: "角色不存在" }, { status: 404 });
  }

  return NextResponse.json(role);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const session = await getServerSession(authOptions);
  const guard = await requireAdmin(session);
  if (guard) return guard;

  const { roleId } = await params;

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    return NextResponse.json({ error: "角色不存在" }, { status: 404 });
  }

  const body = await req.json();
  const { name, description, permissionIds } = body;

  // System roles: only description can be changed
  if (role.isSystem) {
    if (name !== undefined && name !== role.name) {
      return NextResponse.json({ error: "系统角色名称不可修改" }, { status: 400 });
    }
    if (permissionIds !== undefined) {
      return NextResponse.json({ error: "系统角色权限不可修改" }, { status: 400 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined && typeof name === "string" && name.trim()) {
    const trimmedName = name.trim();
    // Check duplicate name
    const existing = await prisma.role.findFirst({
      where: { name: trimmedName, id: { not: roleId } },
    });
    if (existing) {
      return NextResponse.json({ error: "角色名称已存在" }, { status: 409 });
    }
    updateData.name = trimmedName;
  }
  if (description !== undefined) {
    updateData.description = description;
  }

  await prisma.$transaction(async (tx) => {
    await tx.role.update({
      where: { id: roleId },
      data: updateData,
    });

    if (Array.isArray(permissionIds)) {
      // Replace all permissions
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((pid: string) => ({ roleId, permissionId: pid })),
        });
      }
    }
  });

  const updated = await prisma.role.findUnique({
    where: { id: roleId },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const session = await getServerSession(authOptions);
  const guard = await requireAdmin(session);
  if (guard) return guard;

  const { roleId } = await params;

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { _count: { select: { users: true } } },
  });

  if (!role) {
    return NextResponse.json({ error: "角色不存在" }, { status: 404 });
  }

  if (role.isSystem) {
    return NextResponse.json({ error: "系统角色不可删除" }, { status: 400 });
  }

  if (role._count.users > 0) {
    return NextResponse.json({
      error: `该角色下有 ${role._count.users} 个用户，请先移除用户后再删除`,
    }, { status: 400 });
  }

  await prisma.role.delete({ where: { id: roleId } });

  return NextResponse.json({ success: true });
}
