// Maps generic types to SQLite-specific SQL types
export function mapDataType(type: string, args: string | null): string {
  const parsedArgs = args ? tryParseJson(args) : null;

  switch (type) {
    case "STRING":
      const length = parsedArgs?.length || 255;
      return `VARCHAR(${length})`;
    case "TEXT":
      return "TEXT";
    case "INTEGER":
    case "BIGINT":
      return "INTEGER";
    case "FLOAT":
    case "DOUBLE":
      return "REAL";
    case "BOOLEAN":
      return "INTEGER"; // SQLite uses 0/1 for boolean
    case "DATE":
      return "TEXT"; // ISO 8601
    case "DATETIME":
      return "TEXT"; // ISO 8601
    case "TIME":
      return "TEXT";
    case "JSON":
      return "TEXT"; // Stored as text in SQLite
    default:
      return "TEXT";
  }
}

function tryParseJson(str: string): Record<string, unknown> | null {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// Checks if a suggested type is supported by SQLite
export function isTypeSupported(type: string): boolean {
  return ["STRING", "TEXT", "INTEGER", "BIGINT", "FLOAT", "DOUBLE", "BOOLEAN", "DATE", "DATETIME", "TIME", "JSON"].includes(type);
}
