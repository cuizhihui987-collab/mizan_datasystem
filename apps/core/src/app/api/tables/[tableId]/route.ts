import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";
import { isAdmin } from "@mizan/shared-lib/auth/permissions";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { tableId } = await params;

  const table = await prisma.tableDefinition.findFirst({
    where: (await isAdmin(session.user.id))
      ? { id: tableId }
      : {
          id: tableId,
          OR: [
            { schema: { userId: session.user.id } },
            { tablePermissions: { some: { userId: session.user.id } } },
          ],
        },
    select: { id: true, schemaId: true, logicalName: true },
  });

  if (!table) {
    return NextResponse.json({ error: "表不存在" }, { status: 404 });
  }

  const body = await req.json();
  const { logicalName, color } = body;
  const updateData: Record<string, unknown> = {};

  if (logicalName !== undefined) {
    if (typeof logicalName !== "string" || !logicalName.trim()) {
      return NextResponse.json({ error: "表名不能为空" }, { status: 400 });
    }
    const trimmedName = logicalName.trim();
    const existing = await prisma.tableDefinition.findFirst({
      where: { schemaId: table.schemaId, logicalName: trimmedName, id: { not: tableId } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "该数据模型中已存在同名表" }, { status: 409 });
    }
    updateData.logicalName = trimmedName;
  }

  if (color !== undefined) {
    if (color !== null && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return NextResponse.json({ error: "颜色格式无效，使用 #RRGGBB 格式" }, { status: 400 });
    }
    updateData.color = color;
  }

  const updated = await prisma.tableDefinition.update({
    where: { id: tableId },
    data: updateData,
  });

  return NextResponse.json(updated);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { tableId } = await params;

  const table = await prisma.tableDefinition.findFirst({
    where: (await isAdmin(session.user.id))
      ? { id: tableId }
      : {
          id: tableId,
          OR: [
            { schema: { userId: session.user.id } },
            { tablePermissions: { some: { userId: session.user.id } } },
          ],
        },
    include: {
      columns: { orderBy: { ordinalPosition: "asc" } },
      indexes: true,
      sourceForeignKeys: { include: { sourceColumns: true } },
      triggers: true,
    },
  });

  if (!table) {
    return NextResponse.json({ error: "表不存在" }, { status: 404 });
  }

  return NextResponse.json(table);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { tableId } = await params;

  const table = await prisma.tableDefinition.findFirst({
    where: (await isAdmin(session.user.id))
      ? { id: tableId }
      : {
          id: tableId,
          OR: [
            { schema: { userId: session.user.id } },
            { tablePermissions: { some: { userId: session.user.id } } },
          ],
        },
  });

  if (!table) {
    return NextResponse.json({ error: "表不存在" }, { status: 404 });
  }

  // If table was created in DB, drop it first
  if (table.status !== "DRAFT") {
    try {
      const { prisma: dslPrisma } = await import("@/lib/db/prisma");
      await dslPrisma.$executeRawUnsafe(
        `DROP TABLE IF EXISTS "${table.physicalName}"`
      );
    } catch {
      // Table might not exist, continue with metadata deletion
    }
  }

  try {
    await prisma.tableDefinition.delete({ where: { id: tableId } });
  } catch (error) {
    console.error("删除表失败:", error);
    return NextResponse.json({ error: "删除失败，请检查该表是否被其他表的外键引用" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
