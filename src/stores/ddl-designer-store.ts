import { create } from "zustand";
import type { ColumnDef, IndexDef, ForeignKeyDef, TriggerDef } from "@/lib/ddl/ddl-generator";

let idCounter = 0;
function genId() {
  return `tmp_${++idCounter}_${Date.now()}`;
}

export interface ColumnFormData {
  id: string;
  logicalName: string;
  physicalName: string;
  dataType: string;
  dataTypeArgs: string | null;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  defaultValue: string;
  autoIncrement: boolean;
  ordinalPosition: number;
  checkExpression: string;
}

export interface FKFormData {
  id: string;
  constraintName: string;
  sourceColumnIds: string[];
  referencedTableName: string;
  referencedPhysicalName: string;
  refColumnIds: string[];
  onDelete: string;
  onUpdate: string;
}

export interface IndexFormData {
  id: string;
  indexName: string;
  columnIds: string[];
  isUnique: boolean;
}

export interface TriggerFormData {
  id: string;
  triggerName: string;
  timing: string;
  event: string;
  logic: string;
  enabled: boolean;
}

type DDLTab = "columns" | "foreign-keys" | "indexes" | "triggers" | "preview";

interface ValidationError {
  tab: DDLTab;
  message: string;
}

interface DDLDesignerState {
  // Table info
  tableId: string;
  tableLogicalName: string;
  tablePhysicalName: string;

  // Form data
  columns: ColumnFormData[];
  foreignKeys: FKFormData[];
  indexes: IndexFormData[];
  triggers: TriggerFormData[];

  // UI state
  activeTab: DDLTab;
  validationErrors: ValidationError[];
  isDirty: boolean;
  isSaving: boolean;

  // Actions
  setTableInfo: (id: string, logicalName: string, physicalName: string) => void;

  setActiveTab: (tab: DDLTab) => void;

  // Column actions
  addColumn: () => void;
  updateColumn: (id: string, data: Partial<ColumnFormData>) => void;
  removeColumn: (id: string) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;

  // FK actions
  addForeignKey: () => void;
  updateForeignKey: (id: string, data: Partial<FKFormData>) => void;
  removeForeignKey: (id: string) => void;

  // Index actions
  addIndex: () => void;
  updateIndex: (id: string, data: Partial<IndexFormData>) => void;
  removeIndex: (id: string) => void;

  // Trigger actions
  addTrigger: () => void;
  updateTrigger: (id: string, data: Partial<TriggerFormData>) => void;
  removeTrigger: (id: string) => void;

  // State management
  reset: () => void;
  validate: () => ValidationError[];
  loadFromDefinition: (data: {
    id: string;
    logicalName: string;
    physicalName: string;
    columns: ColumnDef[];
    indexes: IndexDef[];
    foreignKeys: ForeignKeyDef[];
    triggers: TriggerDef[];
  }) => void;
}

const initialColumn = (ordinal: number): ColumnFormData => ({
  id: genId(),
  logicalName: "",
  physicalName: "",
  dataType: "STRING",
  dataTypeArgs: null,
  isNullable: true,
  isPrimaryKey: false,
  isUnique: false,
  defaultValue: "",
  autoIncrement: false,
  ordinalPosition: ordinal,
  checkExpression: "",
});

export const useDDLDesignerStore = create<DDLDesignerState>((set, get) => ({
  tableId: "",
  tableLogicalName: "",
  tablePhysicalName: "",
  columns: [initialColumn(1)],
  foreignKeys: [],
  indexes: [],
  triggers: [],
  activeTab: "columns",
  validationErrors: [],
  isDirty: false,
  isSaving: false,

  setTableInfo: (id, logicalName, physicalName) =>
    set({ tableId: id, tableLogicalName: logicalName, tablePhysicalName: physicalName }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  addColumn: () => {
    const { columns } = get();
    const maxOrdinal = Math.max(0, ...columns.map((c) => c.ordinalPosition));
    set({
      columns: [...columns, initialColumn(maxOrdinal + 1)],
      isDirty: true,
    });
  },

  updateColumn: (id, data) => {
    const { columns } = get();
    set({
      columns: columns.map((c) => (c.id === id ? { ...c, ...data } : c)),
      isDirty: true,
    });
  },

  removeColumn: (id) => {
    const { columns } = get();
    set({
      columns: columns.filter((c) => c.id !== id),
      isDirty: true,
    });
  },

  reorderColumns: (fromIndex, toIndex) => {
    const { columns } = get();
    const sorted = [...columns].sort(
      (a, b) => a.ordinalPosition - b.ordinalPosition
    );
    const [moved] = sorted.splice(fromIndex, 1);
    sorted.splice(toIndex, 0, moved);
    const reordered = sorted.map((col, idx) => ({
      ...col,
      ordinalPosition: idx + 1,
    }));
    set({ columns: reordered, isDirty: true });
  },

  addForeignKey: () => {
    const { foreignKeys } = get();
    set({
      foreignKeys: [
        ...foreignKeys,
        {
          id: genId(),
          constraintName: `fk_${foreignKeys.length + 1}`,
          sourceColumnIds: [],
          referencedTableName: "",
          referencedPhysicalName: "",
          refColumnIds: [],
          onDelete: "NO ACTION",
          onUpdate: "NO ACTION",
        },
      ],
      isDirty: true,
    });
  },

  updateForeignKey: (id, data) => {
    const { foreignKeys } = get();
    set({
      foreignKeys: foreignKeys.map((fk) =>
        fk.id === id ? { ...fk, ...data } : fk
      ),
      isDirty: true,
    });
  },

  removeForeignKey: (id) => {
    const { foreignKeys } = get();
    set({
      foreignKeys: foreignKeys.filter((fk) => fk.id !== id),
      isDirty: true,
    });
  },

  addIndex: () => {
    const { indexes } = get();
    set({
      indexes: [
        ...indexes,
        {
          id: genId(),
          indexName: `idx_${indexes.length + 1}`,
          columnIds: [],
          isUnique: false,
        },
      ],
      isDirty: true,
    });
  },

  updateIndex: (id, data) => {
    const { indexes } = get();
    set({
      indexes: indexes.map((idx) =>
        idx.id === id ? { ...idx, ...data } : idx
      ),
      isDirty: true,
    });
  },

  removeIndex: (id) => {
    const { indexes } = get();
    set({
      indexes: indexes.filter((idx) => idx.id !== id),
      isDirty: true,
    });
  },

  addTrigger: () => {
    const { triggers } = get();
    set({
      triggers: [
        ...triggers,
        {
          id: genId(),
          triggerName: `trg_${triggers.length + 1}`,
          timing: "AFTER",
          event: "INSERT",
          logic: "",
          enabled: true,
        },
      ],
      isDirty: true,
    });
  },

  updateTrigger: (id, data) => {
    const { triggers } = get();
    set({
      triggers: triggers.map((tr) =>
        tr.id === id ? { ...tr, ...data } : tr
      ),
      isDirty: true,
    });
  },

  removeTrigger: (id) => {
    const { triggers } = get();
    set({
      triggers: triggers.filter((tr) => tr.id !== id),
      isDirty: true,
    });
  },

  reset: () =>
    set({
      columns: [initialColumn(1)],
      foreignKeys: [],
      indexes: [],
      triggers: [],
      validationErrors: [],
      isDirty: false,
    }),

  validate: () => {
    const errors: ValidationError[] = [];
    const { columns, foreignKeys, indexes } = get();

    if (columns.length === 0) {
      errors.push({ tab: "columns", message: "至少需要定义一个字段" });
    }

    const emptyNames = columns.filter((c) => !c.logicalName);
    if (emptyNames.length > 0) {
      errors.push({ tab: "columns", message: "所有字段都必须有名称" });
    }

    for (const fk of foreignKeys) {
      if (fk.sourceColumnIds.length === 0) {
        errors.push({
          tab: "foreign-keys",
          message: `外键 "${fk.constraintName}" 未选择源字段`,
        });
      }
      if (!fk.referencedTableName) {
        errors.push({
          tab: "foreign-keys",
          message: `外键 "${fk.constraintName}" 未选择引用表`,
        });
      }
    }

    for (const idx of indexes) {
      if (idx.columnIds.length === 0) {
        errors.push({
          tab: "indexes",
          message: `索引 "${idx.indexName}" 未选择字段`,
        });
      }
    }

    set({ validationErrors: errors });
    return errors;
  },

  loadFromDefinition: (data) => {
    set({
      tableId: data.id,
      tableLogicalName: data.logicalName,
      tablePhysicalName: data.physicalName,
      columns:
        data.columns.length > 0
          ? data.columns.map((c) => ({
              id: c.id,
              logicalName: c.logicalName,
              physicalName: c.physicalName,
              dataType: c.dataType,
              dataTypeArgs: c.dataTypeArgs,
              isNullable: c.isNullable,
              isPrimaryKey: c.isPrimaryKey,
              isUnique: c.isUnique,
              defaultValue: c.defaultValue || "",
              autoIncrement: c.autoIncrement,
              ordinalPosition: c.ordinalPosition,
              checkExpression: c.checkExpression || "",
            }))
          : [initialColumn(1)],
      foreignKeys: data.foreignKeys.map((fk) => ({
        id: fk.id,
        constraintName: fk.constraintName,
        sourceColumnIds: fk.sourceColumnIds,
        referencedTableName: fk.referencedPhysicalName,
        referencedPhysicalName: fk.referencedPhysicalName,
        refColumnIds: fk.refColumnIds,
        onDelete: fk.onDelete,
        onUpdate: fk.onUpdate,
      })),
      indexes: data.indexes.map((idx) => ({
        id: idx.id,
        indexName: idx.indexName,
        columnIds: idx.columnIds,
        isUnique: idx.isUnique,
      })),
      triggers: data.triggers.map((tr) => ({
        id: tr.id,
        triggerName: tr.triggerName,
        timing: tr.timing,
        event: tr.event,
        logic: tr.logic,
        enabled: tr.enabled,
      })),
      isDirty: false,
    });
  },
}));
