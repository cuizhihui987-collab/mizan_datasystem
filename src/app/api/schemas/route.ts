import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { isAdmin } from "@/lib/auth/permissions";
import { z } from "zod";

const createSchemaSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100),
  description: z.string().max(500).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const schemas = await prisma.schema.findMany({
    where: (await isAdmin(session.user.id))
      ? { status: "ACTIVE" }
      : {
          status: "ACTIVE",
          OR: [
            { userId: session.user.id },
            { tables: { some: { tablePermissions: { some: { userId: session.user.id } } } } },
          ],
        },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { tables: true } },
      user: { select: { name: true, email: true } },
    },
  });

  // Fix table counts for non-owner users
  if (!(await isAdmin(session.user.id))) {
    for (const schema of schemas) {
      if (schema.userId !== session.user.id) {
        const count = await prisma.tablePermission.count({
          where: { userId: session.user.id, table: { schemaId: schema.id } },
        });
        (schema as Record<string, unknown>)._count = { tables: count };
      }
    }
  }

  return NextResponse.json(schemas);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createSchemaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "输入无效" },
        { status: 400 }
      );
    }

    const schema = await prisma.schema.create({
      data: {
        userId: session.user.id,
        name: parsed.data.name,
        description: parsed.data.description,
      },
    });

    return NextResponse.json(schema, { status: 201 });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2002") {
      return NextResponse.json({ error: "该名称已存在" }, { status: 409 });
    }
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
