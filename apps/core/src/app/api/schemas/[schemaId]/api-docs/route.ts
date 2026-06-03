import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@mizan/database";

// GET /api/schemas/[schemaId]/api-docs — Generate API docs for all tables in schema
export async function GET(
  req: Request,
  { params }: { params: Promise<{ schemaId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { schemaId } = await params;

  const schema = await prisma.schema.findFirst({
    where: { id: schemaId, userId: session.user.id },
    include: {
      tables: {
        include: { columns: { orderBy: { ordinalPosition: "asc" } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!schema) {
    return NextResponse.json({ error: "数据模型不存在" }, { status: 404 });
  }

  const baseUrl = `${req.headers.get("x-forwarded-proto") || "http"}://${req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000"}`;

  const docs = {
    schema: {
      id: schema.id,
      name: schema.name,
      description: schema.description,
    },
    baseUrl,
    endpoints: schema.tables.map((table) => {
      const userColumns = table.columns.filter(
        (c) => !["_id", "_created_at", "_updated_at"].includes(c.physicalName)
      );

      const columnsSchema = userColumns.map((c) => ({
        name: c.logicalName,
        field: c.physicalName,
        type: c.dataType,
        required: !c.isNullable,
        primaryKey: c.isPrimaryKey,
        unique: c.isUnique,
        defaultValue: c.defaultValue,
        description: c.description,
      }));

      return {
        table: {
          id: table.id,
          logicalName: table.logicalName,
          physicalName: table.physicalName,
          status: table.status,
        },
        columns: columnsSchema,
        api: {
          getTable: {
            method: "GET",
            path: `/api/tables/${table.id}`,
            description: "获取表元数据（字段定义、索引、外键等）",
            response: "TableDefinition 对象",
          },
          listData: {
            method: "GET",
            path: `/api/tables/${table.id}/data`,
            description: "查询表数据（分页、排序、搜索）",
            parameters: {
              query: [
                { name: "page", type: "number", default: 1, description: "页码" },
                { name: "pageSize", type: "number", default: 50, max: 100, description: "每页条数" },
                { name: "sort", type: "string", optional: true, description: "排序字段（physicalName）" },
                { name: "order", type: "enum(asc|desc)", default: "asc", description: "排序方向" },
                { name: "search", type: "string", optional: true, description: "全局搜索关键词" },
                { name: "filters", type: "JSON", optional: true, description: '结构化筛选条件: {"logic":"and","conditions":[{"column":"...","operator":"eq","value":"..."}]}' },
              ],
            },
            response: '{ columns: ColumnMeta[], rows: Record[] }',
            example: `${baseUrl}/api/tables/${table.id}/data?page=1&pageSize=10`,
          },
          insertRow: {
            method: "POST",
            path: `/api/tables/${table.id}/data`,
            description: "插入单行数据",
            requestBody: columnsSchema.reduce((acc, c) => {
              acc[c.field] = c.type === "INTEGER" ? 0 : c.type === "FLOAT" ? 0.0 : c.type === "BOOLEAN" ? true : "string";
              return acc;
            }, {} as Record<string, unknown>),
            example: JSON.stringify(
              userColumns.slice(0, 3).reduce((acc, c) => {
                acc[c.logicalName] = `示例${c.logicalName}`;
                return acc;
              }, {} as Record<string, string>),
              null, 2
            ),
          },
          updateRow: {
            method: "PUT",
            path: `/api/tables/${table.id}/data`,
            description: "更新单行或批量更新",
            requestBody: {
              "single": '{ "_id": 1, "field": "newValue" }',
              "batch": '{ "ids": [1,2,3], "column": "field", "value": "newValue" }',
            },
          },
          deleteRow: {
            method: "DELETE",
            path: `/api/tables/${table.id}/data`,
            description: "删除单行或批量删除",
            requestBody: {
              "single": '{ "_id": 1 }',
              "batch": '{ "ids": [1,2,3] }',
            },
          },
          batchImport: {
            method: "POST",
            path: `/api/tables/${table.id}/batch-import`,
            description: "按匹配字段批量导入（新增/更新）",
            requestBody: {
              keyColumn: "匹配字段的 physicalName",
              rows: "[ { field1: val1, field2: val2 }, ... ]",
            },
          },
          export: {
            method: "GET",
            path: `/api/tables/${table.id}/export`,
            description: "导出表数据（Excel 或 CSV）",
            parameters: {
              query: [
                { name: "format", type: "enum(xlsx|csv)", default: "xlsx", description: "导出格式" },
              ],
            },
          },
          executeDDL: {
            method: "POST",
            path: `/api/tables/${table.id}/execute`,
            description: "执行 DDL（创建/更新表结构）",
            requestBody: {
              ddl: "CREATE TABLE ...",
              physicalName: "mzan_tbl_xxx",
              columns: "[ 列定义数组 ]",
            },
          },
        },
      };
    }),
  };

  return NextResponse.json(docs);
}
