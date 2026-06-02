"use client";

import { create } from "zustand";

export interface PipelineStepForm {
  id?: string;
  stepOrder: number;
  stepType: string;
  label: string;
  config: Record<string, unknown>;
  sourceTableId?: string;
}

interface PipelineStore {
  // Editor state
  steps: PipelineStepForm[];
  isDirty: boolean;
  pipelineName: string;
  pipelineDescription: string;

  // Actions
  setPipelineMeta: (name: string, description: string) => void;
  setSteps: (steps: PipelineStepForm[]) => void;
  addStep: (step: PipelineStepForm) => void;
  updateStep: (index: number, data: Partial<PipelineStepForm>) => void;
  removeStep: (index: number) => void;
  reorderSteps: (fromIndex: number, toIndex: number) => void;
  reset: () => void;
}

export const usePipelineStore = create<PipelineStore>((set) => ({
  steps: [],
  isDirty: false,
  pipelineName: "",
  pipelineDescription: "",

  setPipelineMeta: (name, description) =>
    set({ pipelineName: name, pipelineDescription: description, isDirty: true }),

  setSteps: (steps) => set({ steps, isDirty: false }),

  addStep: (step) =>
    set((state) => ({
      steps: [...state.steps, step],
      isDirty: true,
    })),

  updateStep: (index, data) =>
    set((state) => {
      const newSteps = [...state.steps];
      newSteps[index] = { ...newSteps[index], ...data };
      return { steps: newSteps, isDirty: true };
    }),

  removeStep: (index) =>
    set((state) => ({
      steps: state.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepOrder: i })),
      isDirty: true,
    })),

  reorderSteps: (fromIndex, toIndex) =>
    set((state) => {
      const newSteps = [...state.steps];
      const [moved] = newSteps.splice(fromIndex, 1);
      newSteps.splice(toIndex, 0, moved);
      return {
        steps: newSteps.map((s, i) => ({ ...s, stepOrder: i })),
        isDirty: true,
      };
    }),

  reset: () =>
    set({
      steps: [],
      isDirty: false,
      pipelineName: "",
      pipelineDescription: "",
    }),
}));
