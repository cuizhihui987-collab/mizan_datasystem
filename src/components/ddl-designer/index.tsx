"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useDDLDesignerStore } from "@/stores/ddl-designer-store";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ColumnList } from "./column-editor";
import { ForeignKeyEditor } from "./foreign-key-editor";
import { IndexEditor } from "./index-editor";
import { TriggerEditor } from "./trigger-editor";
import { DDLPreview } from "./ddl-preview";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Play, Save } from "lucide-react";

interface TableData {
  id: string;
  logicalName: string;
  physicalName: string;
  status: string;
  columns: Array<{
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
  }>;
  indexes: Array<{
    id: string;
    indexName: string;
    columnIds: string;
    isUnique: boolean;
  }>;
  sourceForeignKeys: Array<{
    id: string;
    constraintName: string;
    sourceColumnIds: string;
    referencedTableId: string;
    refColumnIds: string;
    onDelete: string;
    onUpdate: string;
  }>;
  triggers: Array<{
    id: string;
    triggerName: string;
    timing: string;
    event: string;
    logic: string;
    enabled: boolean;
  }>;
}

interface DDLDesignerProps {
  schemaId: string;
  tableId: string;
}

export function DDLDesigner({ schemaId, tableId }: DDLDesignerProps) {
  const router = useRouter();
  const store = useDDLDesignerStore();
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const { data: table, isLoading } = useQuery<TableData>({
    queryKey: ["table", tableId],
    queryFn: () => fetch(`/api/tables/${tableId}`).then((r) => r.json()),
  });

  useEffect(() => {
    if (table) {
      store.loadFromDefinition({
        id: table.id,
        logicalName: table.logicalName,
        physicalName: table.physicalName,
        columns: table.columns || [],
        indexes: (table.indexes || []).map((idx) => ({
          ...idx,
          columnIds: JSON.parse(idx.columnIds || "[]"),
        })),
        foreignKeys: (table.sourceForeignKeys || []).map((fk) => ({
          ...fk,
          sourceColumnIds: JSON.parse(fk.sourceColumnIds || "[]"),
          refColumnIds: JSON.parse(fk.refColumnIds || "[]"),
          referencedPhysicalName: fk.referencedTableId || "",
        })),
        triggers: table.triggers || [],
      });
    }
  }, [table]);

  const handleExecuteDDL = async () => {
    const errors = store.validate();
    if (errors.length > 0) {
      setResult({ success: false, message: "请修正验证错误后再执行" });
      return;
    }

    setExecuting(true);
    setResult(null);

    try {
      const generator = new (await import("@/lib/ddl/ddl-generator")).DDLGenerator();
      const def = {
        tableId: store.tableId,
        logicalName: store.tableLogicalName,
        physicalName: store.tablePhysicalName,
        columns: store.columns.map((c) => ({
          id: c.id,
          logicalName: c.logicalName,
          physicalName: c.physicalName,
          dataType: c.dataType,
          dataTypeArgs: c.dataTypeArgs,
          isNullable: c.isNullable,
          isPrimaryKey: c.isPrimaryKey,
          isUnique: c.isUnique,
          defaultValue: c.defaultValue || null,
          autoIncrement: c.autoIncrement,
          ordinalPosition: c.ordinalPosition,
          checkExpression: c.checkExpression || null,
        })),
        indexes: store.indexes.map((idx) => ({
          id: idx.id,
          indexName: idx.indexName,
          columnIds: idx.columnIds,
          isUnique: idx.isUnique,
        })),
        foreignKeys: store.foreignKeys.map((fk) => ({
          id: fk.id,
          constraintName: fk.constraintName,
          sourceColumnIds: fk.sourceColumnIds,
          referencedTableId: "",
          referencedPhysicalName: fk.referencedPhysicalName,
          refColumnIds: fk.refColumnIds,
          onDelete: fk.onDelete,
          onUpdate: fk.onUpdate,
        })),
        triggers: store.triggers.map((tr) => ({
          id: tr.id,
          triggerName: tr.triggerName,
          timing: tr.timing,
          event: tr.event,
          logic: tr.logic,
          enabled: tr.enabled,
        })),
      };

      const ddl = generator.generateCreateTable(def);
      const validation = generator.validate(def);

      if (validation.errors.length > 0) {
        setResult({
          success: false,
          message: validation.errors.join("；"),
        });
        return;
      }

      const res = await fetch(`/api/tables/${tableId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ddl,
          physicalName: store.tablePhysicalName,
          columns: def.columns,
          indexes: def.indexes,
          foreignKeys: def.foreignKeys,
          triggers: def.triggers,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: "表创建成功！" });
        setTimeout(() => {
          router.push(`/schemas/${schemaId}/tables/${tableId}`);
        }, 1500);
      } else {
        setResult({
          success: false,
          message: data.error || "执行失败",
        });
      }
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : "执行失败",
      });
    } finally {
      setExecuting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!table) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">表不存在</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          返回
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold">DDL 设计器</h1>
            <p className="text-sm text-muted-foreground">
              {table.logicalName} ({table.physicalName})
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => store.validate()}>
            <Save className="h-4 w-4 mr-1" />
            验证
          </Button>
          <Button onClick={handleExecuteDDL} disabled={executing}>
            <Play className="h-4 w-4 mr-1" />
            {executing ? "执行中..." : "执行 DDL"}
          </Button>
        </div>
      </div>

      {result && (
        <Card
          className={
            result.success
              ? "border-green-500 bg-green-50 dark:bg-green-950"
              : "border-destructive bg-destructive/10"
          }
        >
          <CardContent className="p-4 text-sm">{result.message}</CardContent>
        </Card>
      )}

      <Tabs
        defaultValue="columns"
        value={store.activeTab}
        onValueChange={(v) => store.setActiveTab(v as typeof store.activeTab)}
      >
        <TabsList>
          <TabsTrigger value="columns">字段 ({store.columns.length})</TabsTrigger>
          <TabsTrigger value="foreign-keys">外键 ({store.foreignKeys.length})</TabsTrigger>
          <TabsTrigger value="indexes">索引 ({store.indexes.length})</TabsTrigger>
          <TabsTrigger value="triggers">触发器 ({store.triggers.length})</TabsTrigger>
          <TabsTrigger value="preview">SQL 预览</TabsTrigger>
        </TabsList>

        <TabsContent value="columns" className="mt-4">
          <ColumnList />
        </TabsContent>

        <TabsContent value="foreign-keys" className="mt-4">
          <ForeignKeyEditor />
        </TabsContent>

        <TabsContent value="indexes" className="mt-4">
          <IndexEditor />
        </TabsContent>

        <TabsContent value="triggers" className="mt-4">
          <TriggerEditor />
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <DDLPreview />
        </TabsContent>
      </Tabs>
    </div>
  );
}
