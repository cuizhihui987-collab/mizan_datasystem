import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const schemaId = searchParams.get("schemaId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    schema: { userId: session.user.id },
  };
  if (schemaId) where.schemaId = schemaId;

  const imports = await prisma.importJob.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      table: { select: { logicalName: true } },
      schema: { select: { name: true } },
    },
  });

  return NextResponse.json(imports);
}
