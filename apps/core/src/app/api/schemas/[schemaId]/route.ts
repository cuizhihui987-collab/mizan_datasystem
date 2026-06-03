import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";
import { isAdmin } from "@mizan/shared-lib/auth/permissions";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ schemaId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { schemaId } = await params;

  const schema = await prisma.schema.findFirst({
    where: (await isAdmin(session.user.id))
      ? { id: schemaId }
      : {
          id: schemaId,
          OR: [
            { userId: session.user.id },
            { tables: { some: { tablePermissions: { some: { userId: session.user.id } } } } },
          ],
        },
    include: {
      tables: {
        include: { _count: { select: { columns: true } } },
        orderBy: { createdAt: "desc" },
      },
      user: { select: { name: true, email: true } },
    },
  });

  if (!schema) {
    return NextResponse.json({ error: "数据模型不存在" }, { status: 404 });
  }

  // Non-owner users: only see tables they have permission for
  if (!(await isAdmin(session.user.id)) && schema.userId !== session.user.id) {
    const permittedTableIds = await prisma.tablePermission.findMany({
      where: { userId: session.user.id, table: { schemaId: schema.id } },
      select: { tableId: true },
    });
    const permittedSet = new Set(permittedTableIds.map((p) => p.tableId));
    schema.tables = schema.tables.filter((t) => permittedSet.has(t.id));
  }

  return NextResponse.json(schema);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ schemaId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { schemaId } = await params;
  const body = await req.json();

  const schema = await prisma.schema.findFirst({
    where: { id: schemaId, userId: session.user.id },
  });

  if (!schema) {
    return NextResponse.json({ error: "数据模型不存在" }, { status: 404 });
  }

  const updated = await prisma.schema.update({
    where: { id: schemaId },
    data: {
      name: body.name,
      description: body.description,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ schemaId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { schemaId } = await params;

  const schema = await prisma.schema.findFirst({
    where: { id: schemaId, userId: session.user.id },
  });

  if (!schema) {
    return NextResponse.json({ error: "数据模型不存在" }, { status: 404 });
  }

  // Cascade delete: manually handle relations that lack onDelete: Cascade
  const tables = await prisma.tableDefinition.findMany({
    where: { schemaId },
    select: { id: true },
  });
  const tableIds = tables.map((t) => t.id);

  await prisma.$transaction([
    // ForeignKeyDefinition: FKTtargetTable has no cascade
    prisma.foreignKeyDefinition.deleteMany({
      where: { referencedTableId: { in: tableIds } },
    }),
    // ImportJob: no cascade on schemaId or tableId
    prisma.importJob.deleteMany({
      where: { OR: [{ schemaId }, { tableId: { in: tableIds } }] },
    }),
    // TableDefinition: cascades to ColumnDef, IndexDef, TriggerDef, source FK
    prisma.tableDefinition.deleteMany({ where: { schemaId } }),
    // Finally delete the schema
    prisma.schema.delete({ where: { id: schemaId } }),
  ]);

  return NextResponse.json({ success: true });
}
