import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const columnSchema = z.object({
  sourceName: z.string(),
  logicalName: z.string().min(1, "字段名称不能为空"),
  dataType: z.string().min(1),
  isPrimaryKey: z.boolean().optional().default(false),
  isNullable: z.boolean().optional().default(true),
});

const createTableSchema = z.object({
  logicalName: z.string().min(1, "名称不能为空").max(100),
  description: z.string().max(500).optional(),
  headerRowNumber: z.number().int().min(1).optional().default(1),
  sourceFile: z.string().optional(),
  columns: z.array(columnSchema).optional().default([]),
});

function generatePhysicalName(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "mzan_tbl_";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ schemaId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { schemaId } = await params;

  const tables = await prisma.tableDefinition.findMany({
    where: { schemaId },
    include: { _count: { select: { columns: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tables);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ schemaId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { schemaId } = await params;

  // Verify schema access: owner OR has any table permission in the schema
  let schema = await prisma.schema.findFirst({
    where: { id: schemaId, userId: session.user.id },
  });
  if (!schema) {
    const hasPerm = await prisma.tablePermission.findFirst({
      where: { userId: session.user.id, table: { schemaId } },
    });
    if (hasPerm) {
      schema = await prisma.schema.findUnique({ where: { id: schemaId } });
    }
  }
  if (!schema) {
    return NextResponse.json({ error: "数据模型不存在" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = createTableSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "输入无效" },
        { status: 400 }
      );
    }

    const physicalName = generatePhysicalName();

    const table = await prisma.tableDefinition.create({
      data: {
        schemaId,
        logicalName: parsed.data.logicalName,
        physicalName,
        description: parsed.data.description,
        headerRowNumber: parsed.data.headerRowNumber,
        sourceFile: parsed.data.sourceFile,
        status: "DRAFT",
        columns: {
          create: (() => {
            const usedPhysNames = new Set<string>();
            return parsed.data.columns.map((col, idx) => {
              let phys = col.logicalName
                ? col.logicalName
                    .replace(/[^\w\s一-鿿]/g, "")
                    .replace(/([a-z])([A-Z])/g, "$1_$2")
                    .replace(/[\s]+/g, "_")
                    .toLowerCase()
                    .replace(/[^\w]/g, "")
                    .replace(/^_+|_+$/g, "") || `col_${idx + 1}`
                : `col_${idx + 1}`;

              // Ensure unique: append suffix if duplicate
              if (usedPhysNames.has(phys)) {
                let suffix = 2;
                while (usedPhysNames.has(`${phys}_${suffix}`)) suffix++;
                phys = `${phys}_${suffix}`;
              }
              usedPhysNames.add(phys);

              return {
                logicalName: col.logicalName,
                physicalName: phys,
                dataType: col.dataType,
                isPrimaryKey: col.isPrimaryKey,
                isNullable: col.isNullable,
                ordinalPosition: idx + 1,
              };
            });
          })(),
        },
      },
      include: { columns: true },
    });

    return NextResponse.json(table, { status: 201 });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2002") {
      return NextResponse.json(
        { error: "该模型中已存在同名表" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
