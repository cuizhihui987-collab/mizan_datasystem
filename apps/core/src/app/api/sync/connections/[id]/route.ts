import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";
import { requireAdmin } from "@mizan/shared-lib/auth/permissions";
import { ApiSyncEngine, buildAuthHeader } from "@/lib/sync/api-sync-engine";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const guard = await requireAdmin(session);
  if (guard) return guard;

  const conn = await prisma.syncConnection.findUnique({
    where: { id: (await params).id },
    include: { table: { select: { logicalName: true, physicalName: true } } },
  });
  if (!conn) return NextResponse.json({ error: "连接不存在" }, { status: 404 });

  return NextResponse.json(conn);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const guard = await requireAdmin(session);
  if (guard) return guard;

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.endpoint !== undefined) data.endpoint = body.endpoint;
  if (body.method !== undefined) data.method = body.method;
  if (body.headers !== undefined) data.headers = JSON.stringify(body.headers);
  if (body.authType !== undefined) data.authType = body.authType;
  if (body.authConfig !== undefined) data.authConfig = JSON.stringify(body.authConfig);
  if (body.direction !== undefined) data.direction = body.direction;
  if (body.tableId !== undefined) data.tableId = body.tableId;
  if (body.keyField !== undefined) data.keyField = body.keyField;
  if (body.fieldMapping !== undefined) data.fieldMapping = JSON.stringify(body.fieldMapping);
  if (body.enabled !== undefined) data.enabled = body.enabled;

  const conn = await prisma.syncConnection.update({
    where: { id: (await params).id },
    data,
  });

  return NextResponse.json(conn);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const guard = await requireAdmin(session);
  if (guard) return guard;

  await prisma.syncConnection.delete({ where: { id: (await params).id } });
  return NextResponse.json({ success: true });
}

// POST /api/sync/connections/[id]?action=test — test connection
// POST /api/sync/connections/[id]?action=trigger — trigger sync
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const guard = await requireAdmin(session);
  if (guard) return guard;

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || (await req.json().catch(() => ({}))).action;

  const conn = await prisma.syncConnection.findUnique({ where: { id } });
  if (!conn) return NextResponse.json({ error: "连接不存在" }, { status: 404 });

  if (action === "test") {
    try {
      const headers: Record<string, string> = conn.headers ? JSON.parse(conn.headers) : {};
      const auth = buildAuthHeader(conn.authType, conn.authConfig);
      if (auth) Object.assign(headers, auth);

      const res = await fetch(conn.endpoint, {
        method: "GET",
        headers: { "Content-Type": "application/json", ...headers },
        signal: AbortSignal.timeout(10000),
      });
      return NextResponse.json({ success: res.ok, status: res.status, statusText: res.statusText });
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "连接失败" });
    }
  }

  if (action === "trigger") {
    const direction = conn.direction === "bidirectional" ? "pull" : conn.direction;
    let result: { status: string; totalRows: number; error?: string };

    if (direction === "pull") {
      result = await ApiSyncEngine.pull(id);
    } else {
      result = await ApiSyncEngine.push(id);
    }

    if (result.status === "failed") {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
