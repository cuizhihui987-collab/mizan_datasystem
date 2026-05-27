import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";

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
    where: { id: schemaId, userId: session.user.id },
    include: {
      tables: {
        include: { _count: { select: { columns: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!schema) {
    return NextResponse.json({ error: "数据模型不存在" }, { status: 404 });
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

  await prisma.schema.delete({ where: { id: schemaId } });

  return NextResponse.json({ success: true });
}
