import { prisma } from "@/lib/db/prisma";
import { SpreadsheetParser } from "./spreadsheet-parser";
import path from "path";

interface ColumnMap {
  [physicalName: string]: {
    dataType: string;
    index: number;
  };
}

export class DataImporter {
  private BATCH_SIZE = 500;

  async import(jobId: string): Promise<void> {
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
      include: {
        table: {
          include: { columns: { orderBy: { ordinalPosition: "asc" } } },
        },
      },
    });

    if (!job || !job.table || job.status !== "PENDING") return;

    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: "PROCESSING", startedAt: new Date() },
    });

    try {
      const fullPath = path.join(process.cwd(), "public", job.filePath);
      const parser = new SpreadsheetParser(fullPath);
      const columnMap = this.buildColumnMap(job.table.columns);

      let processedCount = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errors: any[] = [];
      const totalRows = job.totalRows || 0;

      for await (const batch of parser.readBatches(this.BATCH_SIZE, job.headerRow)) {
        const { validRows, errorRows } = this.validateRows(
          batch,
          columnMap,
          processedCount
        );

        if (validRows.length > 0) {
          await this.insertBatch(job.table.physicalName, validRows, columnMap);
        }

        processedCount += batch.length;
        errors.push(...errorRows);

        await prisma.importJob.update({
          where: { id: jobId },
          data: {
            processedRows: processedCount,
            errorRows: errors.length,
            errorLog: JSON.stringify(errors.slice(-100)),
          },
        });
      }

      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          processedRows: processedCount,
          errorRows: errors.length,
          totalRows: Math.max(totalRows, processedCount + errors.length),
          completedAt: new Date(),
        },
      });

      await prisma.tableDefinition.update({
        where: { id: job.table.id },
        data: { status: "IMPORTED" },
      });
    } catch (error) {
      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          errorLog: JSON.stringify([
            { message: error instanceof Error ? error.message : "导入失败" },
          ]),
        },
      });
    }
  }

  private buildColumnMap(
    columns: Array<{
      physicalName: string;
      dataType: string;
      ordinalPosition: number;
    }>
  ): ColumnMap {
    const map: ColumnMap = {};
    columns
      .sort((a, b) => a.ordinalPosition - b.ordinalPosition)
      .forEach((col, index) => {
        map[col.physicalName] = {
          dataType: col.dataType,
          index,
        };
      });
    return map;
  }

  private validateRows(
    rows: unknown[][],
    columnMap: ColumnMap,
    startOffset: number
  ) {
    const validRows: Record<string, unknown>[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorRows: any[] = [];
    const colNames = Object.keys(columnMap);

    rows.forEach((row, rowIdx) => {
      try {
        const mapped: Record<string, unknown> = {};
        colNames.forEach((colName) => {
          const colInfo = columnMap[colName];
          const val = row[colInfo.index];
          mapped[colName] = this.coerceValue(val, colInfo.dataType);
        });
        validRows.push(mapped);
      } catch (err) {
        errorRows.push({
          row: startOffset + rowIdx + 1,
          error: err instanceof Error ? err.message : "数据转换失败",
        });
      }
    });

    return { validRows, errorRows };
  }

  private coerceValue(value: unknown, dataType: string): unknown {
    if (value === "" || value === undefined || value === null) {
      return null;
    }

    switch (dataType) {
      case "INTEGER":
      case "BIGINT": {
        const n = Number(value);
        return isNaN(n) ? value : Math.floor(n);
      }
      case "FLOAT":
      case "DOUBLE": {
        const n = Number(value);
        return isNaN(n) ? value : n;
      }
      case "BOOLEAN": {
        const s = String(value).toLowerCase().trim();
        if (["true", "yes", "1"].includes(s)) return 1;
        if (["false", "no", "0"].includes(s)) return 0;
        return value;
      }
      case "DATE":
      case "DATETIME":
      case "TIME": {
        // Return as string for SQLite TEXT storage
        return String(value);
      }
      default:
        return String(value);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async insertBatch(physicalName: string, rows: Record<string, unknown>[], columnMap: ColumnMap): Promise<void> {
    const colNames = Object.keys(columnMap);
    if (colNames.length === 0 || rows.length === 0) return;

    const tableRef = `"${physicalName}"`;

    for (const row of rows) {
      const cols = colNames.map((c) => `"${c}"`).join(", ");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vals = colNames.map((c) => {
        const v = row[c];
        if (v === null || v === undefined) return "NULL";
        if (typeof v === "number") return String(v);
        return `'${String(v).replace(/'/g, "''")}'`;
      });

      const sql = `INSERT INTO ${tableRef} (${cols}) VALUES (${vals.join(", ")})`;
      await prisma.$executeRawUnsafe(sql);
    }
  }
}
