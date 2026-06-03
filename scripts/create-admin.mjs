import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "operation@test.com";
  const password = "123456";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("用户已存在，更新为管理员角色...");
    await prisma.user.update({
      where: { email },
      data: { role: "ADMIN" },
    });
    console.log("已更新为管理员账号");
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      password: hashed,
      name: "管理员",
      role: "ADMIN",
    },
  });
  console.log("管理员账号创建成功");
}

main()
  .catch((e) => {
    console.error("创建失败:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
