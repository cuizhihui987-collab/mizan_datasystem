export interface FilterCondition {
  column: string;
  operator: "eq" | "neq" | "contains" | "startsWith" | "endsWith" | "gt" | "gte" | "lt" | "lte" | "isEmpty" | "isNotEmpty";
  value: string;
}

export interface FilterGroup {
  logic: "and" | "or";
  conditions: FilterCondition[];
}

export interface QueryOptions {
  page: number;
  pageSize: number;
  sort?: string;
  order?: "asc" | "desc";
  filters?: FilterGroup;
  columns?: string[];  // If provided, SELECT only these columns instead of *
}

function escapeVal(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

export class DynamicQueryBuilder {
  constructor(private physicalName: string) {}

  buildSelectQuery(options: QueryOptions): {
    sql: string;
    countSql: string;
  } {
    const tableRef = `"${this.physicalName}"`;
    const page = Math.max(1, options.page);
    const pageSize = Math.min(100, Math.max(1, options.pageSize));
    const offset = (page - 1) * pageSize;

    const whereSQL = this.buildWhereClause(options.filters);

    let orderSQL = 'ORDER BY "_id" ASC';
    if (options.sort) {
      const sanitizedSort = options.sort.replace(/[^a-z0-9_一-鿿]/gi, "");
      const dir = options.order === "desc" ? "DESC" : "ASC";
      orderSQL = `ORDER BY "${sanitizedSort}" ${dir}`;
    }

    const selectCols = options.columns && options.columns.length > 0
      ? options.columns.map((c) => `"${c.replace(/[^a-z0-9_一-鿿]/gi, "")}"`).join(", ")
      : "*";
    const sql = `SELECT ${selectCols} FROM ${tableRef} ${whereSQL} ${orderSQL} LIMIT ${pageSize} OFFSET ${offset}`;
    const countSql = `SELECT COUNT(*) as total FROM ${tableRef} ${whereSQL}`;

    return { sql, countSql };
  }

  private buildWhereClause(filterGroup?: FilterGroup): string {
    if (!filterGroup || !filterGroup.conditions || filterGroup.conditions.length === 0) {
      return "";
    }

    const clauses = filterGroup.conditions.map((cond) => {
      const col = cond.column.replace(/[^a-z0-9_一-鿿]/gi, "");
      if (!col) return null;
      const quotedCol = `"${col}"`;

      switch (cond.operator) {
        case "eq":
          return `${quotedCol} = ${escapeVal(cond.value)}`;
        case "neq":
          return `${quotedCol} != ${escapeVal(cond.value)}`;
        case "contains":
          return `${quotedCol} LIKE ${escapeVal(`%${cond.value}%`)}`;
        case "startsWith":
          return `${quotedCol} LIKE ${escapeVal(`${cond.value}%`)}`;
        case "endsWith":
          return `${quotedCol} LIKE ${escapeVal(`%${cond.value}`)}`;
        case "gt":
          return `${quotedCol} > ${escapeVal(cond.value)}`;
        case "gte":
          return `${quotedCol} >= ${escapeVal(cond.value)}`;
        case "lt":
          return `${quotedCol} < ${escapeVal(cond.value)}`;
        case "lte":
          return `${quotedCol} <= ${escapeVal(cond.value)}`;
        case "isEmpty":
          return `(${quotedCol} IS NULL OR ${quotedCol} = '')`;
        case "isNotEmpty":
          return `(${quotedCol} IS NOT NULL AND ${quotedCol} != '')`;
        default:
          return null;
      }
    }).filter(Boolean) as string[];

    if (clauses.length === 0) return "";

    const joiner = filterGroup.logic === "or" ? " OR " : " AND ";
    return `WHERE ${clauses.join(joiner)}`;
  }

  buildInsertQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>
  ): { sql: string } {
    const tableRef = `"${this.physicalName}"`;
    const cols = Object.keys(data)
      .map((k) => `"${k.replace(/[^a-z0-9_一-鿿]/gi, "")}"`)
      .join(", ");

    const vals = Object.values(data)
      .map((v) => escapeVal(v))
      .join(", ");

    return {
      sql: `INSERT INTO ${tableRef} (${cols}) VALUES (${vals})`,
    };
  }

  buildUpdateQuery(
    pk: number | string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>
  ): { sql: string } {
    const tableRef = `"${this.physicalName}"`;
    const sets = Object.entries(data)
      .map(([k, v]) => {
        const cleanName = k.replace(/[^a-z0-9_一-鿿]/gi, "");
        if (!cleanName) return null;
        return `"${cleanName}" = ${escapeVal(v)}`;
      })
      .filter(Boolean)
      .join(", ");

    return {
      sql: `UPDATE ${tableRef} SET ${sets} WHERE "_id" = ${Number(pk)}`,
    };
  }

  buildDeleteQuery(pk: number | string): { sql: string } {
    const tableRef = `"${this.physicalName}"`;
    return {
      sql: `DELETE FROM ${tableRef} WHERE "_id" = ${Number(pk)}`,
    };
  }
}
