import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const executeDDLSchema = z.object({
  ddl: z.string().min(1, "DDL 不能为空"),
  physicalName: z.string().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { tableId } = await params;

  const table = await prisma.tableDefinition.findFirst({
    where: { id: tableId, schema: { userId: session.user.id } },
    include: { columns: true },
  });

  if (!table) {
    return NextResponse.json({ error: "表不存在" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = executeDDLSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "输入无效" },
        { status: 400 }
      );
    }

    const { ddl, physicalName } = parsed.data;

    // Safety checks
    const forbiddenPatterns = [
      /DROP\s+DATABASE/i,
      /DROP\s+TABLE\s+(IF\s+EXISTS\s+)?(?!")/i,
      /ALTER\s+SYSTEM/i,
      /CREATE\s+USER/i,
      /GRANT\s+/i,
      /REVOKE\s+/i,
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(ddl)) {
        return NextResponse.json(
          { error: "DDL 包含禁止的操作" },
          { status: 403 }
        );
      }
    }

    // Drop existing table if it exists (for re-execution)
    try {
      await prisma.$executeRawUnsafe(
        `DROP TABLE IF EXISTS "${physicalName}"`
      );
    } catch {
      // Table may not exist yet
    }

    // Execute DDL
    const statements = ddl
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement + ";");
    }

    // Update table status
    await prisma.tableDefinition.update({
      where: { id: tableId },
      data: { status: "CREATED" },
    });

    // Save column definitions to metadata
    for (const col of table.columns) {
      await prisma.columnDefinition.upsert({
        where: { id: col.id },
        create: {
          id: col.id,
          tableId: table.id,
          logicalName: col.logicalName,
          physicalName: col.physicalName,
          dataType: col.dataType,
          dataTypeArgs: col.dataTypeArgs,
          isNullable: col.isNullable,
          isPrimaryKey: col.isPrimaryKey,
          isUnique: col.isUnique,
          defaultValue: col.defaultValue,
          autoIncrement: col.autoIncrement,
          ordinalPosition: col.ordinalPosition,
          checkExpression: col.checkExpression,
        },
        update: {},
      });
    }

    return NextResponse.json({
      success: true,
      physicalName,
      message: "表创建成功",
    });
  } catch (error) {
    console.error("DDL execution error:", error);
    const errMsg =
      error instanceof Error ? error.message : "DDL 执行失败";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
