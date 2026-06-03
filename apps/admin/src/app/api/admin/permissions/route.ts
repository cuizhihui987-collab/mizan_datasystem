import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";
import { requireAdmin } from "@mizan/shared-lib/auth/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  const guard = await requireAdmin(session);
  if (guard) return guard;

  const permissions = await prisma.permission.findMany({
    orderBy: [{ group: "asc" }, { code: "asc" }],
  });

  // Group by category
  const groups: Record<string, typeof permissions> = {};
  for (const perm of permissions) {
    if (!groups[perm.group]) groups[perm.group] = [];
    groups[perm.group].push(perm);
  }

  return NextResponse.json({
    permissions,
    groups: Object.entries(groups).map(([group, perms]) => ({ group, permissions: perms })),
  });
}
