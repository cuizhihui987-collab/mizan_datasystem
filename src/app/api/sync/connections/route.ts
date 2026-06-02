import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  const guard = await requireAdmin(session);
  if (guard) return guard;

  const connections = await prisma.syncConnection.findMany({
    orderBy: { createdAt: "desc" },
    include: { table: { select: { logicalName: true, physicalName: true } } },
  });

  return NextResponse.json(connections);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const guard = await requireAdmin(session);
  if (guard) return guard;

  const body = await req.json();
  const { name, endpoint, method, headers, authType, authConfig, direction, tableId, keyField, fieldMapping } = body;

  if (!name || !endpoint || !tableId) {
    return NextResponse.json({ error: "名称、地址和数据表为必填项" }, { status: 400 });
  }

  const conn = await prisma.syncConnection.create({
    data: {
      name,
      endpoint,
      method: method || "GET",
      headers: headers ? JSON.stringify(headers) : null,
      authType: authType || "none",
      authConfig: authConfig ? JSON.stringify(authConfig) : null,
      direction: direction || "pull",
      tableId,
      keyField: keyField || null,
      fieldMapping: fieldMapping ? JSON.stringify(fieldMapping) : null,
    },
  });

  return NextResponse.json(conn, { status: 201 });
}
