import { create } from "zustand";

export interface BackgroundTask {
  id: string;
  tableId: string;
  fileName: string;
  totalRows: number;
  processedRows: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: number;
}

interface BatchImportState {
  tasks: BackgroundTask[];
  addTask: (task: BackgroundTask) => void;
  updateTask: (id: string, updates: Partial<BackgroundTask>) => void;
  removeTask: (id: string) => void;
  getActiveTasks: (tableId: string) => BackgroundTask[];
}

let taskCounter = 0;
function genTaskId() {
  return `import_${++taskCounter}_${Date.now()}`;
}

export { genTaskId };

export const useBatchImportStore = create<BatchImportState>((set, get) => ({
  tasks: [],

  addTask: (task) =>
    set((state) => ({ tasks: [...state.tasks, task] })),

  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),

  removeTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    })),

  getActiveTasks: (tableId) =>
    get().tasks.filter(
      (t) => t.tableId === tableId && t.status !== "completed" && t.status !== "failed"
    ),
}));
