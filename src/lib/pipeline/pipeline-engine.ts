import { prisma } from "@/lib/db/prisma";
import { SpreadsheetParser } from "@/lib/import/spreadsheet-parser";
import path from "path";

const FORBIDDEN_KEYWORDS = [
  "DROP DATABASE", "CREATE USER", "GRANT", "REVOKE",
  "ATTACH", "DETACH", "VACUUM", "PRAGMA",
];

const FORBIDDEN_PREFIXES = ["ALTER", "DROP ", "INSERT ", "UPDATE ", "DELETE ", "CREATE "];

interface StepConfig {
  [key: string]: unknown;
}

interface ExecutionResult {
  success: boolean;
  pipelineStatus: string;
  stepResults: {
    stepId: string;
    stepLabel: string;
    status: string;
    affectedRows?: number;
    errorMessage?: string;
    outputTable?: string;
  }[];
  error?: string;
}

function generatePhysicalName(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "mzan_pipe_";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function safeIdentifier(name: string): string {
  return name.replace(/[^a-z0-9_一-龿]/gi, "").replace(/"/g, "");
}

function isSQLSafe(sql: string): string | null {
  const upper = sql.toUpperCase().trim();
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH") && !upper.startsWith("VALUES")) {
    return "仅允许 SELECT / WITH 查询";
  }
  for (const kw of FORBIDDEN_KEYWORDS) {
    if (upper.includes(kw)) return `SQL 中包含禁止的关键字: ${kw}`;
  }
  for (const prefix of FORBIDDEN_PREFIXES) {
    if (upper.startsWith(prefix) && !upper.startsWith("SELECT")) {
      return `SQL 不允许以 ${prefix.trim()} 开头`;
    }
  }
  return null;
}

async function getTableColumns(physicalName: string): Promise<{ name: string; type: string }[]> {
  const result = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `PRAGMA table_info("${safeIdentifier(physicalName)}")`
  );
  return result.map((r) => ({
    name: String(r.name),
    type: String(r.type),
  }));
}

export class PipelineEngine {
  async execute(pipelineId: string): Promise<ExecutionResult> {
    const pipeline = await prisma.pipelineDefinition.findUnique({
      where: { id: pipelineId },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    if (!pipeline) {
      return { success: false, pipelineStatus: "FAILED", stepResults: [], error: "Pipeline 不存在" };
    }
    if (pipeline.status === "RUNNING") {
      return { success: false, pipelineStatus: "RUNNING", stepResults: [], error: "Pipeline 正在执行中" };
    }
    if (pipeline.steps.length === 0) {
      return { success: false, pipelineStatus: "FAILED", stepResults: [], error: "Pipeline 中没有任何步骤" };
    }

    // Mark pipeline as running
    await prisma.pipelineDefinition.update({
      where: { id: pipelineId },
      data: { status: "RUNNING" },
    });

    const stepResults: ExecutionResult["stepResults"] = [];
    let previousTableName: string | null = null;

    try {
      for (const step of pipeline.steps) {
        await prisma.pipelineStep.update({
          where: { id: step.id },
          data: { status: "RUNNING", startedAt: new Date() },
        });

        try {
          const result = await this.executeStep(step, previousTableName, pipeline.schemaId);
          previousTableName = step.outputPhysicalName;

          await prisma.pipelineStep.update({
            where: { id: step.id },
            data: { status: "COMPLETED", completedAt: new Date() },
          });

          stepResults.push({
            stepId: step.id,
            stepLabel: step.label || step.stepType,
            status: "COMPLETED",
            affectedRows: result.affectedRows,
            outputTable: step.outputPhysicalName,
          });
        } catch (stepError) {
          const errorMessage = stepError instanceof Error ? stepError.message : String(stepError);
          await prisma.pipelineStep.update({
            where: { id: step.id },
            data: { status: "FAILED", errorLog: JSON.stringify([errorMessage]), completedAt: new Date() },
          });

          stepResults.push({
            stepId: step.id,
            stepLabel: step.label || step.stepType,
            status: "FAILED",
            errorMessage,
          });

          // Mark pipeline as failed
          await prisma.pipelineDefinition.update({
            where: { id: pipelineId },
            data: { status: "FAILED" },
          });

          return { success: false, pipelineStatus: "FAILED", stepResults };
        }
      }

      // All steps completed
      await prisma.pipelineDefinition.update({
        where: { id: pipelineId },
        data: { status: "COMPLETED" },
      });

      return { success: true, pipelineStatus: "COMPLETED", stepResults };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await prisma.pipelineDefinition.update({
        where: { id: pipelineId },
        data: { status: "FAILED" },
      });
      return { success: false, pipelineStatus: "FAILED", stepResults, error: errorMessage };
    }
  }

  private async executeStep(
    step: { id: string; stepType: string; config: string; outputPhysicalName: string; sourceTableId?: string | null },
    previousTableName: string | null,
    schemaId: string
  ): Promise<{ affectedRows: number }> {
    const config: StepConfig = JSON.parse(step.config);
    // Pass schemaId to output_table steps
    config.schemaId = schemaId;

    switch (step.stepType) {
      case "source_table":
        return this.executeSourceTable(step, config);
      case "source_import":
        return this.executeSourceImport(step, config);
      case "source_api":
        return this.executeSourceApi(step, config);
      case "transform_sql":
        return this.executeTransformSql(step, config, previousTableName);
      case "transform_merge":
        return this.executeTransformMerge(step, config, previousTableName);
      case "transform_filter":
        return this.executeTransformFilter(step, config, previousTableName);
      case "output_table":
        return this.executeOutputTable(step, config, previousTableName);
      default:
        throw new Error(`未知的步骤类型: ${step.stepType}`);
    }
  }

  // ── source_table: Snapshot an existing table ──────────────
  private async executeSourceTable(
    step: { outputPhysicalName: string; sourceTableId?: string | null },
    config: StepConfig
  ): Promise<{ affectedRows: number }> {
    const sourceTableId = step.sourceTableId || config.sourceTableId;
    if (!sourceTableId) throw new Error("未指定源数据表");

    const tableDef = await prisma.tableDefinition.findUnique({
      where: { id: String(sourceTableId) },
    });
    if (!tableDef) throw new Error("源数据表不存在");
    if (tableDef.status === "DRAFT") throw new Error("源数据表状态为 DRAFT，尚未创建物理表");

    const physName = safeIdentifier(tableDef.physicalName);
    const outName = safeIdentifier(step.outputPhysicalName);

    // Drop existing temp table if any
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${outName}"`);
    await prisma.$executeRawUnsafe(`CREATE TABLE "${outName}" AS SELECT * FROM "${physName}"`);

    const count = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT COUNT(*) as cnt FROM "${outName}"`
    );
    const affectedRows = Number((count[0] as Record<string, unknown>).cnt);
    return { affectedRows };
  }

  // ── source_import: Import from uploaded file ──────────────
  private async executeSourceImport(
    step: { outputPhysicalName: string },
    config: StepConfig
  ): Promise<{ affectedRows: number }> {
    const fileId = String(config.fileId || "");
    if (!fileId) throw new Error("未指定导入文件");

    const storedFile = await prisma.storedFile.findUnique({ where: { id: fileId } });
    if (!storedFile) throw new Error("文件不存在");

    const filePath = path.resolve(storedFile.storagePath);
    const headerRow = Number(config.headerRow) || 1;

    const parser = new SpreadsheetParser(filePath);
    const parseResult = await parser.parse(headerRow);

    if (parseResult.headers.length === 0) {
      throw new Error("无法检测到表头");
    }

    // Create temp table
    const outName = safeIdentifier(step.outputPhysicalName);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${outName}"`);

    const columnDefs = parseResult.headers.map((h, i) => {
      const safeName = safeIdentifier(h) || `col_${i}`;
      const suggestedType = parseResult.suggestedTypes[i];
      const sqlType = mapDetectedTypeToSQLite(suggestedType?.detectedType || "STRING");
      return `"${safeName}" ${sqlType}`;
    });

    const createSQL = `CREATE TABLE "${outName}" ( "_id" INTEGER PRIMARY KEY AUTOINCREMENT, ${columnDefs.join(", ")} )`;
    await prisma.$executeRawUnsafe(createSQL);

    // Batch insert
    const dataRows = parseResult.sampleRows;
    const colNames = parseResult.headers.map((h) => `"${safeIdentifier(h)}"`).join(",");

    let inserted = 0;
    for (const row of dataRows) {
      const rowArr = Array.isArray(row) ? row : [];
      const rowValues = parseResult.headers.map((_h, ci) => {
        const val = rowArr[ci] ?? null;
        if (val === null || val === "") return "NULL";
        if (typeof val === "number") return String(val);
        return `'${String(val).replace(/'/g, "''")}'`;
      });
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "${safeIdentifier(step.outputPhysicalName)}" (${colNames}) VALUES (${rowValues.join(",")})`
        );
        inserted++;
      } catch {
        // Skip problematic rows
      }
    }

    return { affectedRows: inserted };
  }

  // ── source_api: Fetch data from external API ──────────────
  private async executeSourceApi(
    step: { outputPhysicalName: string },
    config: StepConfig
  ): Promise<{ affectedRows: number }> {
    const endpoint = String(config.endpoint || "");
    if (!endpoint) throw new Error("未指定 API 端点");

    const method = String(config.method || "GET");
    const headers: Record<string, string> = (config.headers as Record<string, string>) || {};
    const fieldMapping: { externalField: string; localColumn: string }[] =
      (config.fieldMapping as { externalField: string; localColumn: string }[]) || [];

    // Build auth header
    const authType = String(config.authType || "none");
    const authConfig = config.authConfig as Record<string, string> | undefined;
    if (authType === "basic" && authConfig) {
      const encoded = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString("base64");
      headers["Authorization"] = `Basic ${encoded}`;
    } else if (authType === "token" && authConfig) {
      headers["Authorization"] = `Bearer ${authConfig.token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(endpoint, {
        method,
        headers,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);

      const data = await response.json();
      let rows: Record<string, unknown>[] = [];

      // Flatten response
      if (Array.isArray(data)) {
        rows = data;
      } else if (data?.data && Array.isArray(data.data)) {
        rows = data.data;
      } else if (data?.rows && Array.isArray(data.rows)) {
        rows = data.rows;
      } else if (data?.result && Array.isArray(data.result)) {
        rows = data.result;
      } else {
        rows = [data];
      }

      if (rows.length === 0) {
        throw new Error("API 返回了空数据");
      }

      // Determine columns
      const columns = fieldMapping.length > 0
        ? fieldMapping.map((m) => ({ external: m.externalField, local: m.localColumn }))
        : Object.keys(rows[0]).map((k) => ({ external: k, local: k }));

      // Create temp table
      const outName = safeIdentifier(step.outputPhysicalName);
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${outName}"`);

      const colDefs = columns.map((c) => `"${safeIdentifier(c.local)}" TEXT`);
      const createSQL = `CREATE TABLE "${outName}" ( "_id" INTEGER PRIMARY KEY AUTOINCREMENT, ${colDefs.join(", ")} )`;
      await prisma.$executeRawUnsafe(createSQL);

      // Insert rows
      let inserted = 0;
      for (const row of rows) {
        const colNames = columns.map((c) => `"${safeIdentifier(c.local)}"`).join(",");
        const colValues = columns.map((c) => {
          const val = getNestedValue(row, c.external);
          if (val === null || val === undefined || val === "") return "NULL";
          if (typeof val === "number") return String(val);
          return `'${String(val).replace(/'/g, "''")}'`;
        });
        const insertSQL = `INSERT INTO "${outName}" (${colNames}) VALUES (${colValues.join(",")})`;
        try {
          await prisma.$executeRawUnsafe(insertSQL);
          inserted++;
        } catch {
          // Skip problematic rows
        }
      }

      return { affectedRows: inserted };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── transform_sql: Custom SQL transformation ──────────────
  private async executeTransformSql(
    step: { outputPhysicalName: string },
    config: StepConfig,
    previousTableName: string | null
  ): Promise<{ affectedRows: number }> {
    const sql = String(config.sql || "");
    if (!sql) throw new Error("未指定 SQL 查询");

    const safeSQL = isSQLSafe(sql);
    if (safeSQL) throw new Error(safeSQL);

    const outName = safeIdentifier(step.outputPhysicalName);

    // Replace {prev} placeholder with previous table name
    let finalSQL = sql;
    if (previousTableName) {
      finalSQL = finalSQL.replace(/\{prev\}/g, safeIdentifier(previousTableName));
    }

    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${outName}"`);
    await prisma.$executeRawUnsafe(`CREATE TABLE "${outName}" AS ${finalSQL}`);

    const count = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT COUNT(*) as cnt FROM "${outName}"`
    );
    const affectedRows = Number((count[0] as Record<string, unknown>).cnt);
    return { affectedRows };
  }

  // ── transform_merge: Merge/join two data sources ──────────
  private async executeTransformMerge(
    step: { outputPhysicalName: string },
    config: StepConfig,
    previousTableName: string | null
  ): Promise<{ affectedRows: number }> {
    const joinType = String(config.joinType || "INNER").toUpperCase();
    const leftOn = String(config.leftOn || "");
    const rightOn = String(config.rightOn || "");
    const rightSource = String(config.rightSource || "");

    if (!["INNER", "LEFT", "RIGHT", "FULL"].includes(joinType)) {
      throw new Error(`不支持的 JOIN 类型: ${joinType}`);
    }
    if (!leftOn || !rightOn) throw new Error("未指定关联字段");
    if (!previousTableName && !rightSource) throw new Error("缺少关联的源数据");

    const outName = safeIdentifier(step.outputPhysicalName);
    const leftTable = safeIdentifier(previousTableName || "");

    // The right source can be another step's output or a physical table
    const rightTable = safeIdentifier(rightSource);

    const fullJoinType = joinType === "FULL" ? "FULL OUTER" : joinType;

    const mergeSQL = `SELECT * FROM "${leftTable}" ${fullJoinType} JOIN "${rightTable}" ON "${leftTable}"."${safeIdentifier(leftOn)}" = "${rightTable}"."${safeIdentifier(rightOn)}"`;

    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${outName}"`);
    await prisma.$executeRawUnsafe(`CREATE TABLE "${outName}" AS ${mergeSQL}`);

    const count = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT COUNT(*) as cnt FROM "${outName}"`
    );
    const affectedRows = Number((count[0] as Record<string, unknown>).cnt);
    return { affectedRows };
  }

  // ── transform_filter: Filter rows using conditions ────────
  private async executeTransformFilter(
    step: { outputPhysicalName: string },
    config: StepConfig,
    previousTableName: string | null
  ): Promise<{ affectedRows: number }> {
    const filters = config.filters as { logic: string; conditions: { column: string; operator: string; value?: string }[] } | undefined;
    if (!filters || !filters.conditions || filters.conditions.length === 0) {
      throw new Error("未指定筛选条件");
    }
    if (!previousTableName) throw new Error("没有可用的上游数据");

    const tableName = safeIdentifier(previousTableName);

    // Build WHERE clause using DynamicQueryBuilder-style conditions
    const whereParts: string[] = [];
    const paramValues: unknown[] = [];

    for (const cond of filters.conditions) {
      const col = safeIdentifier(cond.column);
      if (!col) {
        whereParts.push("1=1");
        continue;
      }
      const colRef = `"${tableName}"."${col}"`;

      switch (cond.operator) {
        case "eq":
          whereParts.push(`${colRef} = ?`);
          paramValues.push(cond.value);
          break;
        case "neq":
          whereParts.push(`${colRef} != ?`);
          paramValues.push(cond.value);
          break;
        case "contains":
          whereParts.push(`${colRef} LIKE ?`);
          paramValues.push(`%${cond.value || ""}%`);
          break;
        case "startsWith":
          whereParts.push(`${colRef} LIKE ?`);
          paramValues.push(`${cond.value || ""}%`);
          break;
        case "endsWith":
          whereParts.push(`${colRef} LIKE ?`);
          paramValues.push(`%${cond.value || ""}`);
          break;
        case "gt":
          whereParts.push(`${colRef} > ?`);
          paramValues.push(cond.value);
          break;
        case "gte":
          whereParts.push(`${colRef} >= ?`);
          paramValues.push(cond.value);
          break;
        case "lt":
          whereParts.push(`${colRef} < ?`);
          paramValues.push(cond.value);
          break;
        case "lte":
          whereParts.push(`${colRef} <= ?`);
          paramValues.push(cond.value);
          break;
        case "isEmpty":
          whereParts.push(`(${colRef} IS NULL OR ${colRef} = '')`);
          break;
        case "isNotEmpty":
          whereParts.push(`(${colRef} IS NOT NULL AND ${colRef} != '')`);
          break;
        default:
          whereParts.push("1=1");
      }
    }

    if (whereParts.length === 0) throw new Error("无效的筛选条件");

    const logic = filters.logic === "or" ? " OR " : " AND ";
    const whereClause = whereParts.join(logic);

    const outName = safeIdentifier(step.outputPhysicalName);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${outName}"`);

    // Use parameterized query for safety
    const selectSQL = `SELECT * FROM "${tableName}" WHERE ${whereClause}`;
    // Since we need parametrized, we'll do it differently
    // Build the SQL with the param values replaced safely
    let safeSQL = selectSQL;
    for (const val of paramValues) {
      if (val === null || val === undefined) {
        safeSQL = safeSQL.replace("?", "NULL");
      } else if (typeof val === "number") {
        safeSQL = safeSQL.replace("?", String(val));
      } else {
        safeSQL = safeSQL.replace("?", `'${String(val).replace(/'/g, "''")}'`);
      }
    }

    await prisma.$executeRawUnsafe(`CREATE TABLE "${outName}" AS ${safeSQL}`);

    const count = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT COUNT(*) as cnt FROM "${outName}"`
    );
    const affectedRows = Number((count[0] as Record<string, unknown>).cnt);
    return { affectedRows };
  }

  // ── output_table: Save to a persistent table ──────────────
  private async executeOutputTable(
    step: { outputPhysicalName: string; sourceTableId?: string | null },
    config: StepConfig,
    previousTableName: string | null
  ): Promise<{ affectedRows: number }> {
    if (!previousTableName) throw new Error("没有可用的上游数据");

    const schemaId = String(config.schemaId || "");
    const tableName = String(config.tableName || "");
    const overwrite = Boolean(config.overwriteIfExists);

    if (!schemaId) throw new Error("未指定 Schema");
    if (!tableName) throw new Error("未指定输出表名");

    const outPhysName = generatePhysicalName();
    const sourcePhysName = safeIdentifier(previousTableName);

    // Check for existing table
    const existingTable = await prisma.tableDefinition.findFirst({
      where: { schemaId, logicalName: tableName },
    });

    if (existingTable) {
      if (!overwrite) {
        throw new Error(`表 "${tableName}" 已存在，请使用覆盖选项或更换表名`);
      }
      // Drop existing physical table if status is not DRAFT
      if (existingTable.status !== "DRAFT") {
        await prisma.$executeRawUnsafe(
          `DROP TABLE IF EXISTS "${safeIdentifier(existingTable.physicalName)}"`
        );
      }
      // Delete metadata
      await prisma.columnDefinition.deleteMany({ where: { tableId: existingTable.id } });
      await prisma.tableDefinition.delete({ where: { id: existingTable.id } });
    }

    // Get columns from source temp table
    const columns = await getTableColumns(sourcePhysName);

    // Create new TableDefinition
    const newTable = await prisma.tableDefinition.create({
      data: {
        schemaId,
        logicalName: tableName,
        physicalName: outPhysName,
        status: "CREATED",
        description: `由 Pipeline 步骤 "${step.sourceTableId || "output"}" 创建`,
      },
    });

    // Create ColumnDefinitions (skip _id, it's auto)
    const colDefs = columns.filter((c) => c.name !== "_id");
    for (const col of colDefs) {
      const dataType = mapSQLiteTypeToGeneric(col.type);
      await prisma.columnDefinition.create({
        data: {
          tableId: newTable.id,
          logicalName: col.name,
          physicalName: col.name,
          dataType,
          ordinalPosition: colDefs.indexOf(col),
        },
      });
    }

    // Copy data
    await prisma.$executeRawUnsafe(
      `DROP TABLE IF EXISTS "${safeIdentifier(outPhysName)}"`
    );
    await prisma.$executeRawUnsafe(
      `CREATE TABLE "${safeIdentifier(outPhysName)}" AS SELECT * FROM "${sourcePhysName}"`
    );

    const count = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT COUNT(*) as cnt FROM "${safeIdentifier(outPhysName)}"`
    );
    const affectedRows = Number((count[0] as Record<string, unknown>).cnt);
    return { affectedRows };
  }
}

// ── Helper functions ──────────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function mapDetectedTypeToSQLite(detected: string): string {
  switch (detected) {
    case "INTEGER": return "INTEGER";
    case "FLOAT": return "REAL";
    case "BOOLEAN": return "INTEGER";
    case "DATE":
    case "DATETIME": return "TEXT";
    default: return "TEXT";
  }
}

function mapSQLiteTypeToGeneric(sqliteType: string): string {
  const upper = sqliteType.toUpperCase();
  if (upper.includes("INT")) return "INTEGER";
  if (upper.includes("REAL") || upper.includes("FLOAT") || upper.includes("DOUBLE")) return "FLOAT";
  if (upper.includes("BOOL")) return "BOOLEAN";
  return "STRING";
}
