import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";
import { requireAdmin } from "@mizan/shared-lib/auth/permissions";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const guard = await requireAdmin(session);
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const connectionId = searchParams.get("connectionId");

  const where = connectionId ? { connectionId } : {};

  const jobs = await prisma.syncJob.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(jobs);
}
