import { DDLDesigner } from "@/components/ddl-designer";

export default async function DDLDesignerPage({
  params,
}: {
  params: Promise<{ schemaId: string; tableId: string }>;
}) {
  const { schemaId, tableId } = await params;
  return <DDLDesigner schemaId={schemaId} tableId={tableId} />;
}
