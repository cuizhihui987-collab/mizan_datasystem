import { mapDataType } from "./type-mapper";

export interface ColumnDef {
  id: string;
  logicalName: string;
  physicalName: string;
  dataType: string;
  dataTypeArgs: string | null;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  defaultValue: string | null;
  autoIncrement: boolean;
  ordinalPosition: number;
  checkExpression: string | null;
}

export interface IndexDef {
  id: string;
  indexName: string;
  columnIds: string[];
  isUnique: boolean;
}

export interface ForeignKeyDef {
  id: string;
  constraintName: string;
  sourceColumnIds: string[];
  referencedTableId: string;
  referencedPhysicalName: string;
  refColumnIds: string[];
  onDelete: string;
  onUpdate: string;
}

export interface TriggerDef {
  id: string;
  triggerName: string;
  timing: string;
  event: string;
  logic: string;
  enabled: boolean;
}

export interface TableDefinitionFull {
  tableId: string;
  logicalName: string;
  physicalName: string;
  columns: ColumnDef[];
  indexes: IndexDef[];
  foreignKeys: ForeignKeyDef[];
  triggers: TriggerDef[];
}

export interface DDLValidation {
  errors: string[];
  warnings: string[];
}

export class DDLGenerator {
  generateCreateTable(def: TableDefinitionFull): string {
    const statements: string[] = [];
    const tableRef = `"${def.physicalName}"`;
    const lines: string[] = [];

    lines.push(`CREATE TABLE ${tableRef} (`);

    // System columns
    lines.push(`  "_id" INTEGER PRIMARY KEY AUTOINCREMENT`);
    lines.push(`  "_created_at" TEXT DEFAULT (datetime('now'))`);
    lines.push(`  "_updated_at" TEXT DEFAULT (datetime('now'))`);

    // User-defined columns
    const sortedColumns = [...def.columns].sort(
      (a, b) => a.ordinalPosition - b.ordinalPosition
    );

    for (const col of sortedColumns) {
      const parts = [`"${col.physicalName}"`];
      parts.push(mapDataType(col.dataType, col.dataTypeArgs));

      if (col.autoIncrement && col.dataType === "INTEGER") {
        // Already handled by _id
      }

      if (!col.isNullable) {
        parts.push("NOT NULL");
      }

      if (col.defaultValue !== null && col.defaultValue !== undefined && col.defaultValue !== "") {
        parts.push(`DEFAULT ${col.defaultValue}`);
      }

      if (col.checkExpression) {
        parts.push(`CHECK (${col.checkExpression})`);
      }

      lines.push(`  ${parts.join(" ")}`);
    }

    // User-specified PK constraint
    const pkColumns = sortedColumns
      .filter((c) => c.isPrimaryKey)
      .map((c) => `"${c.physicalName}"`);

    if (pkColumns.length > 0) {
      // SQLite doesn't support ADD CONSTRAINT for PK in CREATE TABLE
      // We'll use them as composite key
      lines.push(`  PRIMARY KEY ("_id")`);
    }

    // Unique constraints
    const uniqueColumns = sortedColumns.filter(
      (c) => c.isUnique && !c.isPrimaryKey
    );
    for (const col of uniqueColumns) {
      lines.push(
        `  CONSTRAINT "uq_${def.physicalName}_${col.physicalName}" UNIQUE ("${col.physicalName}")`
      );
    }

    lines.push(");");
    statements.push(lines.join(",\n"));

    // Indexes
    for (const idx of def.indexes) {
      const idxCols = idx.columnIds
        .map((cid) => {
          const col = def.columns.find((c) => c.id === cid);
          return col ? `"${col.physicalName}"` : null;
        })
        .filter(Boolean);

      if (idxCols.length > 0) {
        const unique = idx.isUnique ? "UNIQUE " : "";
        statements.push(
          `CREATE ${unique}INDEX "${idx.indexName}" ON "${def.physicalName}" (${idxCols.join(", ")});`
        );
      }
    }

    // Foreign keys (need to be separate ALTER TABLE for SQLite)
    // Note: For simplicity, we include FK in CREATE TABLE
    // SQLite parses them but may not enforce without PRAGMA
    for (const fk of def.foreignKeys) {
      const srcCols = fk.sourceColumnIds
        .map((cid) => {
          const col = def.columns.find((c) => c.id === cid);
          return col ? `"${col.physicalName}"` : null;
        })
        .filter(Boolean);

      const refCols: string[] = []; // Reference PK by default (simplified)

      // We need to add FK as ALTER TABLE since we already have a table definition
      if (srcCols.length > 0) {
        statements.push(
          `ALTER TABLE "${def.physicalName}" ADD CONSTRAINT "${fk.constraintName}" ` +
            `FOREIGN KEY (${srcCols.join(", ")}) ` +
            `REFERENCES "${fk.referencedPhysicalName}" (${refCols.join(", ")}) ` +
            `ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate};`
        );
      }
    }

    // Triggers
    for (const tr of def.triggers) {
      if (tr.enabled && tr.logic) {
        statements.push(
          `CREATE TRIGGER "${tr.triggerName}" ` +
            `${tr.timing} ${tr.event} ON "${def.physicalName}" ` +
            `FOR EACH ROW\nBEGIN\n  ${tr.logic}\nEND;`
        );
      }
    }

    // Enable foreign keys
    statements.unshift("PRAGMA foreign_keys = ON;");

    return statements.join("\n\n");
  }

  validate(def: TableDefinitionFull): DDLValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate column names are unique
    const physicalNames = def.columns.map((c) => c.physicalName);
    const duplicateNames = physicalNames.filter(
      (n, i) => physicalNames.indexOf(n) !== i
    );
    if (duplicateNames.length > 0) {
      errors.push(`存在重复列名: ${[...new Set(duplicateNames)].join(", ")}`);
    }

    // Validate at least one column
    if (def.columns.length === 0) {
      errors.push("至少需要定义一个字段");
    }

    // Validate table name
    if (!def.physicalName || !def.logicalName) {
      errors.push("表名称不能为空");
    }

    // Validate FK reference columns exist
    // (basic check - in full version, we'd check against referenced table metadata)

    // Warning for ALTER TABLE FK on new table
    if (def.foreignKeys.length > 0) {
      warnings.push(
        "外键约束会在表创建后通过 ALTER TABLE 添加。请确保引用的表已存在。"
      );
    }

    // Warning for SQLite specific
    warnings.push(
      "SQLite 对外键约束的支持有限，请确保执行前启用 PRAGMA foreign_keys = ON。"
    );

    return { errors, warnings };
  }
}
