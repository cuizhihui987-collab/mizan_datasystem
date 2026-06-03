import { prisma } from "@mizan/database";

export async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === "ADMIN";
}

export async function requireAdmin(userId: string): Promise<void> {
  if (!(await isAdmin(userId))) {
    throw new Error("需要管理员权限");
  }
}

export async function hasPermission(
  userId: string,
  permissionCode: string
): Promise<boolean> {
  const result = await prisma.userRole.findFirst({
    where: {
      userId,
      role: {
        permissions: {
          some: { permission: { code: permissionCode } },
        },
      },
    },
  });
  return result !== null;
}

export async function getTablePermission(
  tableId: string,
  userId: string
): Promise<{
  canSelect: boolean;
  canInsert: boolean;
  canUpdate: boolean;
  canDelete: boolean;
} | null> {
  const perm = await prisma.tablePermission.findUnique({
    where: { tableId_userId: { tableId, userId } },
  });
  return perm
    ? {
        canSelect: perm.canSelect,
        canInsert: perm.canInsert,
        canUpdate: perm.canUpdate,
        canDelete: perm.canDelete,
      }
    : null;
}

export async function getColumnPermissions(
  tableId: string,
  userId: string
): Promise<Record<string, { canRead: boolean; canWrite: boolean }>> {
  const perms = await prisma.columnPermission.findMany({
    where: { tablePermission: { tableId, userId } },
    include: { column: { select: { physicalName: true } } },
  });
  const result: Record<string, { canRead: boolean; canWrite: boolean }> = {};
  for (const p of perms) {
    result[p.column.physicalName] = {
      canRead: p.canRead,
      canWrite: p.canWrite,
    };
  }
  return result;
}

export async function canAccessTable(
  tableId: string,
  userId: string,
  action: "select" | "insert" | "update" | "delete"
): Promise<boolean> {
  if (await isAdmin(userId)) return true;
  const table = await prisma.tableDefinition.findUnique({
    where: { id: tableId },
    include: { schema: { select: { userId: true } } },
  });
  if (!table) return false;
  if (table.schema.userId === userId) return true;
  const perm = await getTablePermission(tableId, userId);
  if (!perm) return false;
  const actionMap: Record<string, keyof typeof perm> = {
    select: "canSelect",
    insert: "canInsert",
    update: "canUpdate",
    delete: "canDelete",
  };
  return perm[actionMap[action]];
}

export async function getReadableColumnsMap(
  tableId: string,
  userId: string
): Promise<Record<string, boolean>> {
  if (await isAdmin(userId)) return {};
  const table = await prisma.tableDefinition.findUnique({
    where: { id: tableId },
    include: { schema: { select: { userId: true } } },
  });
  if (!table) return {};
  if (table.schema.userId === userId) return {};
  const colPerms = await getColumnPermissions(tableId, userId);
  const result: Record<string, boolean> = {};
  for (const [col, perm] of Object.entries(colPerms)) {
    result[col] = perm.canRead;
  }
  return result;
}

export async function getWritableColumnsMap(
  tableId: string,
  userId: string
): Promise<Record<string, boolean>> {
  if (await isAdmin(userId)) return {};
  const table = await prisma.tableDefinition.findUnique({
    where: { id: tableId },
    include: { schema: { select: { userId: true } } },
  });
  if (!table) return {};
  if (table.schema.userId === userId) return {};
  const colPerms = await getColumnPermissions(tableId, userId);
  const result: Record<string, boolean> = {};
  for (const [col, perm] of Object.entries(colPerms)) {
    result[col] = perm.canWrite;
  }
  return result;
}
