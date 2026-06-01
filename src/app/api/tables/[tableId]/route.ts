import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { isAdmin } from "@/lib/auth/permissions";

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
    where: (await isAdmin(session.user.id)) ? { id: tableId } : { id: tableId, schema: { userId: session.user.id } },
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
    where: (await isAdmin(session.user.id)) ? { id: tableId } : { id: tableId, schema: { userId: session.user.id } },
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

  await prisma.tableDefinition.delete({ where: { id: tableId } });

  return NextResponse.json({ success: true });
}
