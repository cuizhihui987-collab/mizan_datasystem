import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";

/**
 * GET /api/tables/resolve?physicalName=xxx
 * 通过物理表名查找 TableDefinition 及其列信息。
 * 用于在 pipeline 步骤配置中动态加载列名。
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const physicalName = searchParams.get("physicalName");

  if (!physicalName) {
    return NextResponse.json({ error: "缺少 physicalName 参数" }, { status: 400 });
  }

  const table = await prisma.tableDefinition.findFirst({
    where: { physicalName },
    include: {
      columns: { orderBy: { ordinalPosition: "asc" } },
    },
  });

  if (!table) {
    return NextResponse.json({ error: "表不存在" }, { status: 404 });
  }

  return NextResponse.json(table);
}
