import { prisma } from "@/lib/db/prisma";
import { DynamicQueryBuilder } from "@/lib/query/dynamic-query-builder";

interface FieldMapping {
  externalField: string;
  localColumn: string;
}

export function buildAuthHeader(authType: string, authConfig: string | null): Record<string, string> | null {
  if (!authConfig || authType === "none") return null;
  try {
    const cfg = JSON.parse(authConfig);
    if (authType === "basic" && cfg.username) {
      const encoded = Buffer.from(`${cfg.username}:${cfg.password || ""}`).toString("base64");
      return { Authorization: `Basic ${encoded}` };
    }
    if (authType === "token" && cfg.token) {
      return { Authorization: `Bearer ${cfg.token}` };
    }
  } catch { /* ignore */ }
  return null;
}

export class ApiSyncEngine {
  /**
   * Pull data from external API and write to local table.
   */
  static async pull(connectionId: string): Promise<{ status: string; totalRows: number; error?: string }> {
    const conn = await prisma.syncConnection.findUnique({
      where: { id: connectionId },
      include: { table: { include: { columns: true } } },
    });
    if (!conn || !conn.enabled) return { status: "failed", totalRows: 0, error: "连接不可用" };

    const job = await prisma.syncJob.create({
      data: { connectionId, direction: "pull", status: "processing", startedAt: new Date() },
    });

    try {
      const mappings: FieldMapping[] = conn.fieldMapping ? JSON.parse(conn.fieldMapping) : [];
      const headers: Record<string, string> = conn.headers ? JSON.parse(conn.headers) : {};
      const auth = buildAuthHeader(conn.authType, conn.authConfig);
      if (auth) Object.assign(headers, auth);

      const res = await fetch(conn.endpoint, {
        method: conn.method,
        headers: { "Content-Type": "application/json", ...headers },
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const result = await res.json();
      const rows: Record<string, unknown>[] = Array.isArray(result) ? result : (result.data || result.rows || []);

      // Skip system columns
      const userColumns = conn.table.columns.filter(
        (c) => !["_id", "_created_at", "_updated_at"].includes(c.physicalName)
      );

      let successRows = 0;
      let errorRows = 0;
      const errors: Record<string, unknown>[] = [];
      const queryBuilder = new DynamicQueryBuilder(conn.table.physicalName);

      for (const row of rows) {
        try {
          // Map external fields to local columns
          const mapped: Record<string, unknown> = {};
          if (mappings.length > 0) {
            for (const m of mappings) {
              const val = getNestedValue(row, m.externalField);
              if (val !== undefined) {
                const col = userColumns.find((c) => c.physicalName === m.localColumn);
                mapped[m.localColumn] = col ? coerceValue(val, col.dataType) : val;
              }
            }
          } else {
            // Auto-map by matching keys to column names
            for (const col of userColumns) {
              if (row[col.physicalName] !== undefined) {
                mapped[col.physicalName] = coerceValue(row[col.physicalName], col.dataType);
              } else if (row[col.logicalName] !== undefined) {
                mapped[col.physicalName] = coerceValue(row[col.logicalName], col.dataType);
              }
            }
          }

          if (Object.keys(mapped).length === 0) continue;

          // Upsert based on keyField
          if (conn.keyField && mapped[conn.keyField] !== undefined) {
            const key = mapped[conn.keyField];
            const escapedKey = typeof key === "number" ? String(key) : `'${String(key).replace(/'/g, "''")}'`;
            const existing = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
              `SELECT "_id" FROM "${conn.table.physicalName}" WHERE "${conn.keyField}" = ${escapedKey} LIMIT 1`
            );
            if (existing.length > 0) {
              const { sql } = queryBuilder.buildUpdateQuery(Number(existing[0]._id), mapped);
              await prisma.$executeRawUnsafe(sql);
            } else {
              const { sql } = queryBuilder.buildInsertQuery(mapped);
              await prisma.$executeRawUnsafe(sql);
            }
          } else {
            const { sql } = queryBuilder.buildInsertQuery(mapped);
            await prisma.$executeRawUnsafe(sql);
          }
          successRows++;
        } catch (err) {
          errorRows++;
          errors.push({ row, error: err instanceof Error ? err.message : "sync error" });
        }
      }

      await prisma.syncConnection.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date() },
      });

      await prisma.syncJob.update({
        where: { id: job.id },
        data: { status: "completed", totalRows: rows.length, successRows, errorRows, errorLog: JSON.stringify(errors.slice(0, 100)), completedAt: new Date() },
      });

      return { status: "completed", totalRows: successRows };
    } catch (error) {
      await prisma.syncJob.update({
        where: { id: job.id },
        data: { status: "failed", errorLog: JSON.stringify([{ message: error instanceof Error ? error.message : "sync failed" }]), completedAt: new Date() },
      });
      return { status: "failed", totalRows: 0, error: error instanceof Error ? error.message : "同步失败" };
    }
  }

  /**
   * Push local data to external API.
   */
  static async push(connectionId: string): Promise<{ status: string; totalRows: number; error?: string }> {
    const conn = await prisma.syncConnection.findUnique({
      where: { id: connectionId },
      include: { table: { include: { columns: true } } },
    });
    if (!conn || !conn.enabled) return { status: "failed", totalRows: 0, error: "连接不可用" };

    const job = await prisma.syncJob.create({
      data: { connectionId, direction: "push", status: "processing", startedAt: new Date() },
    });

    try {
      const userColumns = conn.table.columns.filter(
        (c) => !["_id", "_created_at", "_updated_at"].includes(c.physicalName)
      );
      const mappings: FieldMapping[] = conn.fieldMapping ? JSON.parse(conn.fieldMapping) : [];

      // Query local data (limit to 5000 rows for push)
      const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM "${conn.table.physicalName}" ORDER BY "_id" ASC LIMIT 5000`
      );

      const mappedRows = rows.map((row) => {
        const mapped: Record<string, unknown> = {};
        if (mappings.length > 0) {
          for (const m of mappings) {
            mapped[m.externalField] = row[m.localColumn] ?? null;
          }
        } else {
          for (const col of userColumns) {
            mapped[col.physicalName] = row[col.physicalName] ?? null;
          }
        }
        return mapped;
      });

      const headers: Record<string, string> = conn.headers ? JSON.parse(conn.headers) : {};
      const auth = buildAuthHeader(conn.authType, conn.authConfig);
      if (auth) Object.assign(headers, auth);

      const res = await fetch(conn.endpoint, {
        method: conn.method || "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(mappedRows),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      await prisma.syncConnection.update({
        where: { id: connectionId },
        data: { lastSyncAt: new Date() },
      });

      await prisma.syncJob.update({
        where: { id: job.id },
        data: { status: "completed", totalRows: mappedRows.length, successRows: mappedRows.length, completedAt: new Date() },
      });

      return { status: "completed", totalRows: mappedRows.length };
    } catch (error) {
      await prisma.syncJob.update({
        where: { id: job.id },
        data: { status: "failed", errorLog: JSON.stringify([{ message: error instanceof Error ? error.message : "push failed" }]), completedAt: new Date() },
      });
      return { status: "failed", totalRows: 0, error: error instanceof Error ? error.message : "推送失败" };
    }
  }
}

function coerceValue(value: unknown, dataType: string): unknown {
  if (value === "" || value === undefined || value === null) return null;
  switch (dataType) {
    case "INTEGER":
    case "BIGINT": { const n = Number(value); return isNaN(n) ? String(value) : Math.floor(n); }
    case "FLOAT":
    case "DOUBLE": { const n = Number(value); return isNaN(n) ? String(value) : n; }
    case "BOOLEAN": {
      const s = String(value).toLowerCase().trim();
      if (["true", "yes", "1"].includes(s)) return 1;
      if (["false", "no", "0"].includes(s)) return 0;
      return value;
    }
    default: return String(value);
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return path.split(".").reduce((acc: any, key: string) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
}
