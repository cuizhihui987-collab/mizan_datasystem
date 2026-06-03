import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, FileSpreadsheet, Table, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { HomeDashboardPanel } from "@/components/dashboard/home-dashboard-panel";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  const [schemaCount, tableCount, importCount, dashboardCount] = await Promise.all([
    prisma.schema.count({
      where: { userId: session?.user?.id, status: "ACTIVE" },
    }),
    prisma.tableDefinition.count({
      where: { schema: { userId: session?.user?.id } },
    }),
    prisma.importJob.count({
      where: { schema: { userId: session?.user?.id } },
    }),
    prisma.dashboard.count({
      where: { schema: { userId: session?.user?.id } },
    }),
  ]);

  const recentSchemas = await prisma.schema.findMany({
    where: { userId: session?.user?.id, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: { _count: { select: { tables: true, dashboards: true } } },
  });

  const stats = [
    { label: "数据模型", value: schemaCount, icon: Database, href: "/schemas" },
    { label: "数据表", value: tableCount, icon: Table, href: "/schemas" },
    { label: "看板", value: dashboardCount, icon: LayoutDashboard, href: "/schemas" },
    { label: "导入记录", value: importCount, icon: FileSpreadsheet, href: "/imports" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">仪表盘</h1>
        <p className="text-muted-foreground mt-1">
          欢迎回来，{session?.user?.name || session?.user?.email}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="transition-colors hover:bg-accent/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">最近更新的数据模型</CardTitle>
        </CardHeader>
        <CardContent>
          {recentSchemas.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>还没有创建数据模型</p>
              <Link href="/schemas/new" className="text-primary hover:underline mt-2 inline-block">
                创建第一个数据模型
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSchemas.map((schema) => (
                <Link
                  key={schema.id}
                  href={`/schemas/${schema.id}`}
                  className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-accent/50"
                >
                  <div>
                    <p className="font-medium">{schema.name}</p>
                    {schema.description && (
                      <p className="text-sm text-muted-foreground">{schema.description}</p>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {schema._count.tables} 个表
                    {schema._count.dashboards > 0 && (
                      <> · {schema._count.dashboards} 个看板</>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <HomeDashboardPanel />
    </div>
  );
}
