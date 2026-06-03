"use client";

import { useMemo, useState } from "react";
import { useDDLDesignerStore } from "@/stores/ddl-designer-store";
import { DDLGenerator } from "@/lib/ddl/ddl-generator";
import { Button } from "@/components/ui/button";
import { Copy, AlertCircle, CheckCircle2 } from "lucide-react";

export function DDLPreview() {
  const store = useDDLDesignerStore();
  const [copied, setCopied] = useState(false);

  const { ddl, warnings, errors } = useMemo(() => {
    const generator = new DDLGenerator();
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

    const validation = generator.validate(def);
    const ddl = generator.generateCreateTable(def);

    return {
      ddl,
      warnings: validation.warnings,
      errors: validation.errors,
    };
  }, [
    store.tableId,
    store.tableLogicalName,
    store.tablePhysicalName,
    store.columns,
    store.indexes,
    store.foreignKeys,
    store.triggers,
  ]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(ddl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>验证错误</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-1">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>提示</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-1">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="relative">
        <pre className="rounded-md bg-muted p-4 overflow-x-auto text-sm font-mono leading-relaxed">
          <code>{ddl}</code>
        </pre>
        <Button
          variant="outline"
          size="sm"
          className="absolute top-2 right-2"
          onClick={copyToClipboard}
        >
          {copied ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
              已复制
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-1" />
              复制
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Alert component used internally
function Alert({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: "default" | "destructive";
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        variant === "destructive"
          ? "border-destructive/50 text-destructive"
          : "border-border"
      }`}
    >
      {children}
    </div>
  );
}

function AlertTitle({ children }: { children: React.ReactNode }) {
  return <h5 className="mb-1 font-medium leading-none tracking-tight">{children}</h5>;
}

function AlertDescription({ children }: { children: React.ReactNode }) {
  return <div className="text-sm [&_p]:leading-relaxed mt-1">{children}</div>;
}
