import type { OptionItem } from "./step-config-registry";

/** 获取当前 schema 下所有非 DRAFT 的表列表 */
export async function fetchSchemaTables(
  schemaId: string,
  valueKey: "id" | "physicalName" = "id"
): Promise<OptionItem[]> {
  const res = await fetch(`/api/schemas/${schemaId}?tables=true`);
  if (!res.ok) return [];
  const schema = await res.json();
  return (schema.tables || [])
    .filter((t: { status: string }) => t.status !== "DRAFT")
    .map((t: { id: string; logicalName: string; physicalName: string }) => ({
      label: `${t.logicalName} (${t.physicalName})`,
      value: valueKey === "physicalName" ? t.physicalName : t.id,
    }));
}

/** 根据表定义 UUID 获取列列表 */
export async function fetchTableColumns(tableId: string): Promise<OptionItem[]> {
  if (!tableId) return [];
  const res = await fetch(`/api/tables/${tableId}`);
  if (!res.ok) return [];
  const table = await res.json();
  return (table.columns || []).map(
    (c: { id: string; physicalName: string; logicalName: string; dataType: string }) => ({
      label: `${c.logicalName} (${c.physicalName})`,
      value: c.physicalName,
    })
  );
}

/** 根据物理表名获取列列表（用于 pipeline merge 步骤等场景） */
export async function fetchTableColumnsByPhysicalName(physicalName: string): Promise<OptionItem[]> {
  if (!physicalName) return [];
  const res = await fetch(`/api/tables/resolve?physicalName=${encodeURIComponent(physicalName)}`);
  if (!res.ok) return [];
  const table = await res.json();
  return (table.columns || []).map(
    (c: { id: string; physicalName: string; logicalName: string; dataType: string }) => ({
      label: `${c.logicalName} (${c.physicalName})`,
      value: c.physicalName,
    })
  );
}

/** 获取当前 schema 下的导入文件列表 */
export async function fetchImportFiles(schemaId: string): Promise<OptionItem[]> {
  const res = await fetch(`/api/imports?schemaId=${schemaId}`);
  if (!res.ok) return [];
  const imports = await res.json();
  return (imports || []).map(
    (j: { id: string; fileName: string }) => ({
      label: j.fileName,
      value: j.id,
    })
  );
}
