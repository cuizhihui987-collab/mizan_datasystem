import * as XLSX from "xlsx";

export interface ParseResult {
  headers: string[];
  sampleRows: unknown[][];
  totalRows: number;
  suggestedTypes: SuggestedType[];
  sheetNames: string[];
}

export interface SuggestedType {
  columnIndex: number;
  columnName: string;
  detectedType: "STRING" | "INTEGER" | "FLOAT" | "BOOLEAN" | "DATE" | "DATETIME";
  confidence: number;
  nullCount: number;
  sampleValues: unknown[];
}

export class SpreadsheetParser {
  constructor(private filePath: string) {}

  async parse(headerRow: number): Promise<ParseResult> {
    const workbook = XLSX.readFile(this.filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    });

    const headers =
      rawData[headerRow - 1]?.map((h: unknown) => String(h).trim()) ?? [];
    const dataRows = rawData.slice(headerRow);
    const sampleRows = dataRows.slice(0, 100);
    const totalRows = dataRows.length;

    const suggestedTypes = this.detectTypes(headers, sampleRows);

    return {
      headers,
      sampleRows,
      totalRows,
      suggestedTypes,
      sheetNames: workbook.SheetNames,
    };
  }

  private detectTypes(
    headers: string[],
    sampleRows: unknown[][]
  ): SuggestedType[] {
    return headers.map((name, colIdx) => {
      const values = sampleRows
        .map((row) => row[colIdx])
        .filter((v) => v !== "" && v !== undefined);
      const nullCount = sampleRows.length - values.length;

      const typeChecks: Array<{
        type: SuggestedType["detectedType"];
        test: (v: string) => boolean;
      }> = [
        {
          type: "INTEGER",
          test: (v: string) => /^-?\d+$/.test(String(v).trim()),
        },
        {
          type: "FLOAT",
          test: (v: string) => /^-?\d+\.?\d*$/.test(String(v).trim()),
        },
        {
          type: "BOOLEAN",
          test: (v: string) =>
            ["true", "false", "yes", "no", "1", "0"].includes(
              String(v).trim().toLowerCase()
            ),
        },
        {
          type: "DATETIME",
          test: (v: string) => !isNaN(Date.parse(String(v))),
        },
        {
          type: "DATE",
          test: (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim()),
        },
      ];

      let bestType: SuggestedType["detectedType"] = "STRING";
      let bestScore = 0;

      for (const { type, test } of typeChecks) {
        const matches = values.filter((v) => test(String(v))).length;
        const score = values.length > 0 ? matches / values.length : 0;
        if (score > bestScore) {
          bestScore = score;
          bestType = type;
        }
      }

      return {
        columnIndex: colIdx,
        columnName: name,
        detectedType: bestType,
        confidence: bestScore,
        nullCount,
        sampleValues: values.slice(0, 5),
      };
    });
  }

  async *readBatches(
    batchSize: number,
    headerRow: number
  ): AsyncGenerator<unknown[][]> {
    const workbook = XLSX.readFile(this.filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    });
    const dataRows = rawData.slice(headerRow);

    for (let i = 0; i < dataRows.length; i += batchSize) {
      yield dataRows.slice(i, i + batchSize);
    }
  }
}
