export interface QueryOptions {
  page: number;
  pageSize: number;
  sort?: string;
  order?: "asc" | "desc";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters?: Record<string, any>;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

export class DynamicQueryBuilder {
  constructor(private physicalName: string) {}

  buildSelectQuery(options: QueryOptions): {
    sql: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: any[];
  } {
    const tableRef = `"${this.physicalName}"`;
    const page = Math.max(1, options.page);
    const pageSize = Math.min(100, Math.max(1, options.pageSize));
    const offset = (page - 1) * pageSize;

    // Build WHERE clause from filters
    const whereClauses: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any[] = [];

    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        if (value !== null && value !== undefined && value !== "") {
          const sanitizedKey = key.replace(/[^a-z0-9_]/gi, "");
          whereClauses.push(`"${sanitizedKey}" LIKE ?`);
          params.push(`%${value}%`);
        }
      }
    }

    const whereSQL =
      whereClauses.length > 0
        ? `WHERE ${whereClauses.join(" AND ")}`
        : "";

    // Sort
    let orderSQL = "ORDER BY \"_id\" ASC";
    if (options.sort) {
      const sanitizedSort = options.sort.replace(/[^a-z0-9_]/gi, "");
      const dir = options.order === "desc" ? "DESC" : "ASC";
      orderSQL = `ORDER BY "${sanitizedSort}" ${dir}`;
    }

    const dataSQL = `SELECT * FROM ${tableRef} ${whereSQL} ${orderSQL} LIMIT ${pageSize} OFFSET ${offset}`;
    const countSQL = `SELECT COUNT(*) as total FROM ${tableRef} ${whereSQL}`;

    return {
      sql: `${dataSQL}; ${countSQL}`,
      params,
    };
  }

  buildInsertQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>
  ): { sql: string; values: string[] } {
    const tableRef = `"${this.physicalName}"`;
    const cols = Object.keys(data)
      .map((k) => `"${k.replace(/[^a-z0-9_]/gi, "")}"`)
      .join(", ");

    const vals = Object.values(data).map((v) => {
      if (v === null || v === undefined) return "NULL";
      if (typeof v === "number") return String(v);
      return `'${String(v).replace(/'/g, "''")}'`;
    });

    return {
      sql: `INSERT INTO ${tableRef} (${cols}) VALUES (${vals.join(", ")})`,
      values: vals,
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
        const col = `"${k.replace(/[^a-z0-9_]/gi, "")}"`;
        if (v === null || v === undefined) return `${col} = NULL`;
        if (typeof v === "number") return `${col} = ${v}`;
        return `${col} = '${String(v).replace(/'/g, "''")}'`;
      })
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
