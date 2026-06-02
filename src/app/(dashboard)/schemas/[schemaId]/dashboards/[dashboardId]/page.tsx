"use client";

import { useParams } from "next/navigation";
import { DashboardEditor } from "@/components/dashboard/dashboard-editor";

export default function DashboardPage() {
  const params = useParams();
  const schemaId = params.schemaId as string;
  const dashboardId = params.dashboardId as string;

  return <DashboardEditor schemaId={schemaId} dashboardId={dashboardId} />;
}
