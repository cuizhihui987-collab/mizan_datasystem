import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  const guard = await requireAdmin(session);
  if (guard) return guard;

  const roles = await prisma.role.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { users: true, permissions: true } },
    },
  });

  return NextResponse.json(roles);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const guard = await requireAdmin(session);
  if (guard) return guard;

  const body = await req.json();
  const { name, description, permissionIds } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "角色名称不能为空" }, { status: 400 });
  }

  const trimmedName = name.trim();

  // Check for duplicate name
  const existing = await prisma.role.findUnique({ where: { name: trimmedName } });
  if (existing) {
    return NextResponse.json({ error: "角色名称已存在" }, { status: 409 });
  }

  const role = await prisma.role.create({
    data: {
      name: trimmedName,
      description: description || null,
      permissions: Array.isArray(permissionIds)
        ? { create: permissionIds.map((pid: string) => ({ permissionId: pid })) }
        : undefined,
    },
    include: {
      _count: { select: { users: true, permissions: true } },
    },
  });

  return NextResponse.json(role, { status: 201 });
}
