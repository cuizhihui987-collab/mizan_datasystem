import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding roles and permissions...");

  // ── Permissions ──────────────────────────────────────
  const permissions = [
    // Admin access
    { code: "admin:access", name: "访问管理后台", group: "system" },
    // User management
    { code: "user:list", name: "查看用户列表", group: "user" },
    { code: "user:edit", name: "编辑用户角色", group: "user" },
    { code: "user:delete", name: "删除用户", group: "user" },
    // Role management
    { code: "role:list", name: "查看角色列表", group: "role" },
    { code: "role:create", name: "创建角色", group: "role" },
    { code: "role:edit", name: "编辑角色", group: "role" },
    { code: "role:delete", name: "删除角色", group: "role" },
    // Permission management
    { code: "permission:list", name: "查看权限列表", group: "permission" },
    { code: "permission:assign", name: "分配权限", group: "permission" },
  ];

  const createdPermissions: Record<string, string> = {};
  for (const p of permissions) {
    const perm = await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name, group: p.group },
      create: p,
    });
    createdPermissions[p.code] = perm.id;
  }
  console.log(`  ✓ ${permissions.length} permissions`);

  // ── Roles ─────────────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where: { name: "超级管理员" },
    update: { description: "拥有所有系统权限" },
    create: { name: "超级管理员", description: "拥有所有系统权限", isSystem: true },
  });

  const userRole = await prisma.role.upsert({
    where: { name: "普通用户" },
    update: { description: "默认角色，无管理权限" },
    create: { name: "普通用户", description: "默认角色，无管理权限", isSystem: true },
  });
  console.log("  ✓ 2 roles");

  // ── Role-Permission assignments ──────────────────────
  // Admin gets all permissions
  for (const permId of Object.values(createdPermissions)) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permId } },
      update: {},
      create: { roleId: adminRole.id, permissionId: permId },
    });
  }
  console.log(`  ✓ ${Object.values(createdPermissions).length} permissions → 超级管理员`);

  // ── Backfill existing users ──────────────────────────
  const allUsers = await prisma.user.findMany({ select: { id: true, role: true } });
  for (const user of allUsers) {
    const targetRole = user.role === "ADMIN" ? adminRole : userRole;
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: targetRole.id } },
      update: {},
      create: { userId: user.id, roleId: targetRole.id },
    });
  }
  console.log(`  ✓ ${allUsers.length} users backfilled with roles`);

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
