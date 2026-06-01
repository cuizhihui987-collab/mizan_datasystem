import { prisma } from "@/lib/db/prisma";

export interface TablePermissionInfo {
  isOwner: boolean;
  canSelect: boolean;
  canInsert: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface ColumnPermissionInfo {
  columnId: string;
  physicalName: string;
  canRead: boolean;
  canWrite: boolean;
}

/**
 * Check if a user is a system admin.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === "ADMIN";
}

/**
 * Get table-level permissions for a user on a specific table.
 * Schema owners and ADMINS always get full access.
 */
export async function getTablePermission(
  tableId: string,
  userId: string
): Promise<TablePermissionInfo> {
  // Admin gets full access to everything
  if (await isAdmin(userId)) {
    return { isOwner: true, canSelect: true, canInsert: true, canUpdate: true, canDelete: true };
  }

  const table = await prisma.tableDefinition.findUnique({
    where: { id: tableId },
    select: { schema: { select: { userId: true } } },
  });

  if (!table) {
    return { isOwner: false, canSelect: false, canInsert: false, canUpdate: false, canDelete: false };
  }

  // Owner gets full access
  if (table.schema.userId === userId) {
    return { isOwner: true, canSelect: true, canInsert: true, canUpdate: true, canDelete: true };
  }

  // Check for explicit permission record
  const perm = await prisma.tablePermission.findUnique({
    where: { tableId_userId: { tableId, userId } },
  });

  if (!perm) {
    return { isOwner: false, canSelect: false, canInsert: false, canUpdate: false, canDelete: false };
  }

  return {
    isOwner: false,
    canSelect: perm.canSelect,
    canInsert: perm.canInsert,
    canUpdate: perm.canUpdate,
    canDelete: perm.canDelete,
  };
}

/**
 * Get column-level permissions for a user on a specific table.
 * Returns null for owners and admins (all columns fully accessible).
 */
export async function getColumnPermissions(
  tableId: string,
  userId: string
): Promise<ColumnPermissionInfo[] | null> {
  const perm = await getTablePermission(tableId, userId);

  // Owner or admin: no column restrictions
  if (perm.isOwner) return null;
  if (!perm.canSelect) return [];

  const tp = await prisma.tablePermission.findUnique({
    where: { tableId_userId: { tableId, userId } },
    include: {
      columnPermissions: {
        include: { column: { select: { physicalName: true } } },
      },
    },
  });

  if (!tp || tp.columnPermissions.length === 0) {
    return null;
  }

  return tp.columnPermissions.map((cp) => ({
    columnId: cp.columnId,
    physicalName: cp.column.physicalName,
    canRead: cp.canRead,
    canWrite: cp.canWrite,
  }));
}

/**
 * Quick gate: check if a user can perform a specific action on a table.
 */
export async function canAccessTable(
  tableId: string,
  userId: string,
  action: "select" | "insert" | "update" | "delete"
): Promise<boolean> {
  const perm = await getTablePermission(tableId, userId);
  if (perm.isOwner) return true;

  switch (action) {
    case "select": return perm.canSelect;
    case "insert": return perm.canInsert;
    case "update": return perm.canUpdate;
    case "delete": return perm.canDelete;
  }
}

/**
 * Get a map of physicalName → canRead for quick lookup.
 */
export async function getReadableColumnsMap(
  tableId: string,
  userId: string
): Promise<Record<string, boolean> | null> {
  const colPerms = await getColumnPermissions(tableId, userId);
  if (colPerms === null) return null;

  const map: Record<string, boolean> = {};
  for (const cp of colPerms) {
    map[cp.physicalName] = cp.canRead;
  }
  return map;
}

/**
 * Get a map of physicalName → canWrite for quick lookup.
 */
export async function getWritableColumnsMap(
  tableId: string,
  userId: string
): Promise<Record<string, boolean> | null> {
  const colPerms = await getColumnPermissions(tableId, userId);
  if (colPerms === null) return null;

  const map: Record<string, boolean> = {};
  for (const cp of colPerms) {
    map[cp.physicalName] = cp.canWrite;
  }
  return map;
}
