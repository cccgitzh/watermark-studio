import { create } from 'zustand';
import { defaultPrintSettings, type PrintSettings } from '../core/print';
import { isReadyImage, useEditor } from './editorStore';

const STORAGE_KEY = 'wms.print.v1';

function loadSettings(): PrintSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultPrintSettings };
    const parsed = JSON.parse(raw) as Partial<PrintSettings>;
    return { ...defaultPrintSettings, ...parsed };
  } catch {
    return { ...defaultPrintSettings };
  }
}

function persist(settings: PrintSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 存储不可用时只保留在内存里，不影响打印
  }
}

export type PrintSlot = 'front' | 'back';

interface PrintState {
  open: boolean;
  frontId: string | null;
  backId: string | null;
  settings: PrintSettings;

  openSheet: () => void;
  closeSheet: () => void;
  assign: (slot: PrintSlot, id: string | null) => void;
  patch: (patch: Partial<PrintSettings>) => void;
  resetSettings: () => void;
}

export const usePrint = create<PrintState>()((set, get) => ({
  open: false,
  frontId: null,
  backId: null,
  settings: loadSettings(),

  openSheet: () => {
    const { images, activeImageId } = useEditor.getState();
    const ready = images.filter(isReadyImage);
    const valid = (id: string | null): id is string =>
      Boolean(id) && ready.some((item) => item.id === id);

    const state = get();
    const active = ready.find((item) => item.id === activeImageId);
    const front = valid(state.frontId)
      ? state.frontId
      : active?.id ?? ready[0]?.id ?? null;
    const back = valid(state.backId) && state.backId !== front
      ? state.backId
      : ready.find((item) => item.id !== front)?.id ?? null;

    set({ open: true, frontId: front, backId: back });
  },

  closeSheet: () => set({ open: false }),

  assign: (slot, id) => {
    const state = get();
    if (slot === 'front') {
      // 同一张图不能同时当正反面：撞了就把另一面让开
      set({ frontId: id, backId: state.backId === id ? null : state.backId });
    } else {
      set({ backId: id, frontId: state.frontId === id ? null : state.frontId });
    }
  },

  patch: (patch) => {
    const settings = { ...get().settings, ...patch };
    persist(settings);
    set({ settings });
  },

  resetSettings: () => {
    persist(defaultPrintSettings);
    set({ settings: { ...defaultPrintSettings } });
  },
}));
