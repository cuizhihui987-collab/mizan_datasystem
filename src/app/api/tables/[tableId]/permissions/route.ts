import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { isAdmin } from "@/lib/auth/permissions";

// GET /api/tables/[tableId]/permissions — Get all permission settings for a table
export async function GET(
  req: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { tableId } = await params;

  // Verify ownership (admin bypass)
  const table = await prisma.tableDefinition.findFirst({
    where: (await isAdmin(session.user.id)) ? { id: tableId } : { id: tableId, schema: { userId: session.user.id } },
    include: { columns: { orderBy: { ordinalPosition: "asc" } } },
  });

  if (!table) {
    return NextResponse.json({ error: "表不存在" }, { status: 404 });
  }

  const permissions = await prisma.tablePermission.findMany({
    where: { tableId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      columnPermissions: {
        include: { column: { select: { id: true, physicalName: true, logicalName: true } } },
      },
    },
  });

  return NextResponse.json({
    table: {
      id: table.id,
      logicalName: table.logicalName,
    },
    columns: table.columns.map((c) => ({
      id: c.id,
      logicalName: c.logicalName,
      physicalName: c.physicalName,
      dataType: c.dataType,
    })),
    permissions: permissions.map((p) => ({
      id: p.id,
      userId: p.userId,
      userName: p.user.name,
      userEmail: p.user.email,
      canSelect: p.canSelect,
      canInsert: p.canInsert,
      canUpdate: p.canUpdate,
      canDelete: p.canDelete,
      columnPermissions: p.columnPermissions.map((cp) => ({
        id: cp.id,
        columnId: cp.columnId,
        columnPhysicalName: cp.column.physicalName,
        columnLogicalName: cp.column.logicalName,
        canRead: cp.canRead,
        canWrite: cp.canWrite,
      })),
    })),
  });
}

// POST /api/tables/[tableId]/permissions — Add or update a user's permissions
export async function POST(
  req: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { tableId } = await params;

  // Verify ownership (admin bypass)
  const table = await prisma.tableDefinition.findFirst({
    where: (await isAdmin(session.user.id)) ? { id: tableId } : { id: tableId, schema: { userId: session.user.id } },
    select: { id: true, logicalName: true, schemaId: true },
  });

  if (!table) {
    return NextResponse.json({ error: "表不存在" }, { status: 404 });
  }

  const body = await req.json();
  const { userId, canSelect, canInsert, canUpdate, canDelete, columnPermissions } = body;

  if (!userId) {
    return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
  }

  // Validate user exists
  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  // Upsert the table permission
  const perm = await prisma.tablePermission.upsert({
    where: { tableId_userId: { tableId, userId } },
    create: {
      tableId,
      userId,
      canSelect: canSelect ?? true,
      canInsert: canInsert ?? true,
      canUpdate: canUpdate ?? true,
      canDelete: canDelete ?? false,
    },
    update: {
      canSelect: canSelect ?? true,
      canInsert: canInsert ?? true,
      canUpdate: canUpdate ?? true,
      canDelete: canDelete ?? false,
    },
  });

  // Handle column permissions if provided
  if (columnPermissions && Array.isArray(columnPermissions)) {
    await prisma.columnPermission.deleteMany({
      where: { tablePermissionId: perm.id },
    });

    if (columnPermissions.length > 0) {
      await prisma.columnPermission.createMany({
        data: columnPermissions.map((cp: { columnId: string; canRead?: boolean; canWrite?: boolean }) => ({
          tablePermissionId: perm.id,
          columnId: cp.columnId,
          canRead: cp.canRead ?? true,
          canWrite: cp.canWrite ?? true,
        })),
      });
    }
  }

  // Send notification to the user about table access
  const sharerName = session.user.name || session.user.email || "管理员";
  await prisma.notification.create({
    data: {
      userId,
      type: "table_shared",
      title: "表权限授予",
      message: `${sharerName} 授予了你访问表「${table.logicalName}」的权限`,
      link: `/schemas/${table.schemaId}/tables/${table.id}/data`,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}

// DELETE /api/tables/[tableId]/permissions?userId=xxx — Remove a user's permissions
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { tableId } = await params;

  // Verify ownership (admin bypass)
  const table = await prisma.tableDefinition.findFirst({
    where: (await isAdmin(session.user.id)) ? { id: tableId } : { id: tableId, schema: { userId: session.user.id } },
  });

  if (!table) {
    return NextResponse.json({ error: "表不存在" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
  }

  await prisma.tablePermission.deleteMany({
    where: { tableId, userId },
  });

  return NextResponse.json({ success: true });
}
