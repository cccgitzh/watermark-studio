import { create } from 'zustand';

export interface BatchProgress {
  total: number;
  done: number;
  failed: number;
  startedAt: number;
  label: string;
  phase: 'render' | 'zip';
}

interface BatchStore {
  progress: BatchProgress | null;
  cancelRequested: boolean;
  setProgress: (progress: BatchProgress | null) => void;
  requestCancel: () => void;
  resetCancel: () => void;
}

export const useBatchStore = create<BatchStore>()((set) => ({
  progress: null,
  cancelRequested: false,
  setProgress: (progress) => set({ progress }),
  requestCancel: () => set({ cancelRequested: true }),
  resetCancel: () => set({ cancelRequested: false }),
}));
