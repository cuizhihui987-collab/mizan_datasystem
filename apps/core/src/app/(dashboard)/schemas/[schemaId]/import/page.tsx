import { ImportWizard } from "@/components/import-wizard";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ schemaId: string }>;
}) {
  const { schemaId } = await params;
  return <ImportWizard schemaId={schemaId} />;
}
