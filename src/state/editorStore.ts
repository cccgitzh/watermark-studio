import { create } from 'zustand';
import {
  builtinPresets,
  cloneDoc,
  createImageLayer,
  createRedactLayer,
  createTextLayer,
  defaultExportSettings,
  MAX_IMAGES,
  MAX_LAYERS,
  uid,
} from '../core/defaults';
import { isLayoutLayer } from '../core/layers';
import { isImageFile, decodeImage, blobToDataUrl } from '../core/imageSource';
import type {
  ExportSettings,
  ImageItem,
  ImageLayer,
  ImportProgress,
  LayoutConfig,
  Preset,
  RedactRegion,
  TextLayer,
  WatermarkLayer,
} from '../core/types';

import { isReadyImage } from '../core/queue';

export type { ImageItem, ImageStatus, ImportProgress } from '../core/types';
export { countPending, isReadyImage, type ReadyImage } from '../core/queue';

export interface CustomFont {
  family: string;
  label: string;
}

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

export type Theme = 'light' | 'dark';

const PRESET_STORAGE_KEY = 'wms.presets.v2';
const THEME_STORAGE_KEY = 'wms.theme.v2';
const HISTORY_LIMIT = 60;

function loadCustomPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Preset[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.layers?.length) : [];
  } catch {
    return [];
  }
}

function persistCustomPresets(presets: Preset[]): void {
  try {
    localStorage.setItem(
      PRESET_STORAGE_KEY,
      JSON.stringify(presets.filter((preset) => !preset.builtin)),
    );
  } catch {
    // 存储空间不足时静默降级：方案只保留在内存中
  }
}

function loadTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface HistoryState {
  past: WatermarkLayer[][];
  future: WatermarkLayer[][];
  lastKey: string | null;
  lastAt: number;
}

export interface EditorState {
  layers: WatermarkLayer[];
  exportSettings: ExportSettings;
  selectedId: string | null;
  images: ImageItem[];
  activeImageId: string | null;
  presets: Preset[];
  customFonts: CustomFont[];
  theme: Theme;
  comparing: boolean;
  toast: Toast | null;
  importProgress: ImportProgress | null;
  pastCount: number;
  futureCount: number;

  addImages: (files: File[]) => Promise<void>;
  retryImage: (id: string) => Promise<void>;
  cancelImports: () => void;
  removeImage: (id: string) => void;
  setActiveImage: (id: string) => void;
  moveImage: (id: string, direction: -1 | 1) => void;
  toggleSkip: (id: string) => void;
  clearImages: () => void;

  addTextLayer: () => void;
  addImageLayer: (file: File) => Promise<void>;
  addRedactLayer: () => void;
  addRedactRegion: (layerId: string, region: RedactRegion) => void;
  updateRedactRegion: (
    layerId: string,
    regionId: string,
    patch: Partial<RedactRegion>,
    coalesceKey?: string,
  ) => void;
  removeRedactRegion: (layerId: string, regionId: string) => void;
  updateLayer: (id: string, patch: Partial<WatermarkLayer>, coalesceKey?: string) => void;
  updateLayout: (id: string, patch: Partial<LayoutConfig>, coalesceKey?: string) => void;
  applyTextPatch: (id: string, patch: Partial<TextLayer>, coalesceKey?: string) => void;
  removeLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  moveLayer: (id: string, direction: -1 | 1) => void;
  selectLayer: (id: string | null) => void;

  setExportSettings: (patch: Partial<ExportSettings>) => void;

  applyPreset: (preset: Preset) => void;
  savePreset: (name: string) => void;
  deletePreset: (id: string) => void;
  addCustomFont: (font: CustomFont) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  setTheme: (theme: Theme) => void;
  setComparing: (value: boolean) => void;
  pushToast: (message: string, kind?: ToastKind) => void;
  clearToast: () => void;
}

const history: HistoryState = { past: [], future: [], lastKey: null, lastAt: 0 };
let toastSeq = 0;
/** 每次导入/取消都自增，旧循环据此提前退出 */
let importSeq = 0;

/** 首屏默认水印：斜向密铺的「仅供办理业务使用」 */
const initialLayer = createTextLayer({
  name: '防盗用斜纹',
  text: '仅供办理业务使用',
  rotation: -24,
  opacity: 0.22,
  layout: { mode: 'tile', gapX: 1.1, gapY: 2.2, stagger: false, padding: 0.04 },
});

export const useEditor = create<EditorState>()((set, get) => {
  /** 写入图层并记录历史；coalesceKey 相同的连续操作合并为一步撤销 */
  const commit = (
    nextLayers: WatermarkLayer[],
    coalesceKey?: string,
    extra?: Partial<EditorState>,
  ) => {
    const now = Date.now();
    const merge =
      Boolean(coalesceKey) &&
      history.lastKey === coalesceKey &&
      now - history.lastAt < 800 &&
      history.past.length > 0;

    if (!merge) {
      history.past.push(cloneDoc(get().layers));
      if (history.past.length > HISTORY_LIMIT) history.past.shift();
    }
    history.future = [];
    history.lastKey = coalesceKey ?? null;
    history.lastAt = now;
    set({
      layers: nextLayers,
      pastCount: history.past.length,
      futureCount: 0,
      ...extra,
    });
  };

  const ensureSelected = (layers: WatermarkLayer[], preferred?: string | null): string | null => {
    if (preferred && layers.some((layer) => layer.id === preferred)) return preferred;
    const current = get().selectedId;
    if (current && layers.some((layer) => layer.id === current)) return current;
    return layers[0]?.id ?? null;
  };

  return {
    layers: [initialLayer],
    exportSettings: { ...defaultExportSettings },
    selectedId: initialLayer.id,
    images: [],
    activeImageId: null,
    presets: [...builtinPresets, ...loadCustomPresets()],
    customFonts: [],
    theme: loadTheme(),
    comparing: false,
    toast: null,
    importProgress: null,
    pastCount: 0,
    futureCount: 0,

    addImages: async (files) => {
      const imageFiles = files.filter(isImageFile);
      if (!imageFiles.length) {
        get().pushToast('没有可用的图片文件', 'error');
        return;
      }
      const room = MAX_IMAGES - get().images.length;
      if (room <= 0) {
        get().pushToast(`队列已满（最多 ${MAX_IMAGES} 张），请先移除部分图片`, 'error');
        return;
      }
      const accepted = imageFiles.slice(0, room);
      if (imageFiles.length > accepted.length) {
        get().pushToast(`队列上限 ${MAX_IMAGES} 张，已忽略多余的图片`, 'info');
      }

      const seq = ++importSeq;
      set({ importProgress: { done: 0, total: accepted.length } });

      const added: ImageItem[] = [];
      let failed = 0;
      let cancelled = false;

      for (let index = 0; index < accepted.length; index += 1) {
        if (seq !== importSeq) {
          cancelled = true;
          break;
        }
        const file = accepted[index];
        try {
          const loaded = await decodeImage(file);
          added.push({
            id: uid('src'),
            name: file.name || `image-${index + 1}`,
            mime: file.type || 'image/png',
            size: file.size,
            width: loaded.width,
            height: loaded.height,
            bitmap: loaded.bitmap,
            skipped: false,
            status: 'ready',
          });
        } catch (error) {
          failed += 1;
          // 失败项留在队列里：用户能看到是哪一张坏了，并能重试或移除
          added.push({
            id: uid('src'),
            name: file.name || `image-${index + 1}`,
            mime: file.type || 'image/png',
            size: file.size,
            width: 0,
            height: 0,
            bitmap: null,
            skipped: false,
            status: 'failed',
            error: error instanceof Error ? error.message : '无法解码这张图片',
            file,
          });
        }
        if (seq === importSeq) set({ importProgress: { done: index + 1, total: accepted.length } });
      }

      set((state) => {
        const images = [...state.images, ...added].slice(0, MAX_IMAGES);
        const activeImageId =
          state.activeImageId ?? images.find((item) => isReadyImage(item))?.id ?? images[0]?.id ?? null;
        return { images, importProgress: null, activeImageId };
      });

      if (cancelled) {
        get().pushToast(
          added.length ? `已取消，先加入 ${added.length} 张` : '已取消读取',
          'info',
        );
        return;
      }
      if (failed) {
        get().pushToast(
          added.length > failed
            ? `已添加 ${added.length - failed} 张，${failed} 张读取失败`
            : `${failed} 张图片读取失败，可重试或移除`,
          'error',
        );
        return;
      }
      if (added.length) get().pushToast(`已添加 ${added.length} 张图片`, 'success');
    },

    retryImage: async (id) => {
      const item = get().images.find((entry) => entry.id === id);
      if (!item?.file) return;
      try {
        const loaded = await decodeImage(item.file);
        set((state) => ({
          images: state.images.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  bitmap: loaded.bitmap,
                  width: loaded.width,
                  height: loaded.height,
                  status: 'ready' as const,
                  error: undefined,
                  file: undefined,
                }
              : entry,
          ),
        }));
        get().pushToast(`已恢复 ${item.name}`, 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : '无法解码这张图片';
        set((state) => ({
          images: state.images.map((entry) =>
            entry.id === id ? { ...entry, error: message } : entry,
          ),
        }));
        get().pushToast(`仍然无法读取 ${item.name}`, 'error');
      }
    },

    cancelImports: () => {
      if (!get().importProgress) return;
      importSeq += 1;
    },

    removeImage: (id) => {
      const state = get();
      const index = state.images.findIndex((item) => item.id === id);
      if (index < 0) return;
      state.images[index].bitmap?.close?.();
      const images = state.images.filter((item) => item.id !== id);
      const activeImageId =
        state.activeImageId === id
          ? images[Math.min(index, images.length - 1)]?.id ?? null
          : state.activeImageId;
      set({ images, activeImageId });
    },

    setActiveImage: (id) => set({ activeImageId: id }),

    moveImage: (id, direction) => {
      const images = [...get().images];
      const index = images.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= images.length) return;
      [images[index], images[target]] = [images[target], images[index]];
      set({ images });
    },

    toggleSkip: (id) =>
      set((state) => ({
        images: state.images.map((item) =>
          item.id === id ? { ...item, skipped: !item.skipped } : item,
        ),
      })),

    clearImages: () => {
      importSeq += 1;
      get().images.forEach((item) => item.bitmap?.close?.());
      set({ images: [], activeImageId: null, importProgress: null });
    },

    addTextLayer: () => {
      if (get().layers.length >= MAX_LAYERS) {
        get().pushToast(`最多支持 ${MAX_LAYERS} 个水印图层`, 'error');
        return;
      }
      const layer = createTextLayer({
        name: `文字 ${get().layers.filter((item) => item.type === 'text').length + 1}`,
        layout: { mode: 'single', anchor: 'center', margin: 0.04, offsetX: 0, offsetY: 0 },
        rotation: 0,
        opacity: 0.6,
        fontSize: 0.05,
      });
      commit([...get().layers, layer], undefined, { selectedId: layer.id });
    },

    addImageLayer: async (file) => {
      if (get().layers.length >= MAX_LAYERS) {
        get().pushToast(`最多支持 ${MAX_LAYERS} 个水印图层`, 'error');
        return;
      }
      try {
        const src = await blobToDataUrl(file);
        const layer: ImageLayer = createImageLayer(src);
        commit([...get().layers, layer], undefined, { selectedId: layer.id });
      } catch {
        get().pushToast('Logo 读取失败', 'error');
      }
    },

    addRedactLayer: () => {
      if (get().layers.length >= MAX_LAYERS) {
        get().pushToast(`最多支持 ${MAX_LAYERS} 个水印图层`, 'error');
        return;
      }
      const layer = createRedactLayer({
        name: `打码 ${get().layers.filter((item) => item.type === 'redact').length + 1}`,
      });
      commit([...get().layers, layer], undefined, { selectedId: layer.id });
    },

    addRedactRegion: (layerId, region) => {
      const layers = get().layers.map((layer) =>
        layer.id === layerId && layer.type === 'redact'
          ? { ...layer, regions: [...layer.regions, region] }
          : layer,
      );
      commit(layers);
    },

    updateRedactRegion: (layerId, regionId, patch, coalesceKey) => {
      const layers = get().layers.map((layer) =>
        layer.id === layerId && layer.type === 'redact'
          ? {
              ...layer,
              regions: layer.regions.map((item) =>
                item.id === regionId ? { ...item, ...patch } : item,
              ),
            }
          : layer,
      );
      commit(layers, coalesceKey);
    },

    removeRedactRegion: (layerId, regionId) => {
      const layers = get().layers.map((layer) =>
        layer.id === layerId && layer.type === 'redact'
          ? { ...layer, regions: layer.regions.filter((item) => item.id !== regionId) }
          : layer,
      );
      commit(layers);
    },

    updateLayer: (id, patch, coalesceKey) => {
      const layers = get().layers.map((layer) =>
        layer.id === id ? ({ ...layer, ...patch } as WatermarkLayer) : layer,
      );
      commit(layers, coalesceKey);
    },

    updateLayout: (id, patch, coalesceKey) => {
      const layers = get().layers.map((layer) =>
        layer.id === id && isLayoutLayer(layer)
          ? { ...layer, layout: { ...layer.layout, ...patch } }
          : layer,
      ) as WatermarkLayer[];
      commit(layers, coalesceKey);
    },

    applyTextPatch: (id, patch, coalesceKey) => {
      const layers = get().layers.map((layer) =>
        layer.id === id && layer.type === 'text' ? { ...layer, ...patch } : layer,
      );
      commit(layers, coalesceKey);
    },

    removeLayer: (id) => {
      const layers = get().layers.filter((layer) => layer.id !== id);
      commit(layers, undefined, { selectedId: ensureSelected(layers, null) });
    },

    duplicateLayer: (id) => {
      const source = get().layers.find((layer) => layer.id === id);
      if (!source) return;
      if (get().layers.length >= MAX_LAYERS) {
        get().pushToast(`最多支持 ${MAX_LAYERS} 个水印图层`, 'error');
        return;
      }
      const prefix = source.type === 'text' ? 'txt' : source.type === 'image' ? 'img' : 'rdt';
      const copy = { ...cloneDoc(source), id: uid(prefix) };
      copy.name = `${source.name} 副本`;
      commit([...get().layers, copy], undefined, { selectedId: copy.id });
    },

    moveLayer: (id, direction) => {
      const layers = [...get().layers];
      const index = layers.findIndex((layer) => layer.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= layers.length) return;
      [layers[index], layers[target]] = [layers[target], layers[index]];
      commit(layers);
    },

    selectLayer: (id) => set({ selectedId: id }),

    setExportSettings: (patch) => set((state) => ({
      exportSettings: { ...state.exportSettings, ...patch },
    })),

    applyPreset: (preset) => {
      const layers = preset.layers.map((layer) => ({
        ...cloneDoc(layer),
        id: uid(layer.type === 'text' ? 'txt' : layer.type === 'image' ? 'img' : 'rdt'),
      })) as WatermarkLayer[];
      commit(layers, undefined, {
        selectedId: layers[0]?.id ?? null,
        exportSettings: { ...get().exportSettings, ...preset.exportSettings },
      });
      get().pushToast(`已应用方案「${preset.name}」`, 'success');
    },

    savePreset: (name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const preset: Preset = {
        id: uid('preset'),
        name: trimmed,
        layers: cloneDoc(get().layers),
        exportSettings: { ...get().exportSettings },
      };
      const presets = [...get().presets, preset];
      persistCustomPresets(presets);
      set({ presets });
      get().pushToast('方案已保存到本地', 'success');
    },

    deletePreset: (id) => {
      const presets = get().presets.filter((preset) => preset.id !== id || preset.builtin);
      persistCustomPresets(presets);
      set({ presets });
    },

    addCustomFont: (font) => set((state) => ({
      customFonts: [...state.customFonts.filter((item) => item.family !== font.family), font],
    })),

    undo: () => {
      const previous = history.past.pop();
      if (!previous) return;
      history.future.push(cloneDoc(get().layers));
      history.lastKey = null;
      const layers = previous;
      set({
        layers,
        selectedId: ensureSelected(layers, null),
        pastCount: history.past.length,
        futureCount: history.future.length,
      });
    },

    redo: () => {
      const next = history.future.pop();
      if (!next) return;
      history.past.push(cloneDoc(get().layers));
      history.lastKey = null;
      set({
        layers: next,
        selectedId: ensureSelected(next, null),
        pastCount: history.past.length,
        futureCount: history.future.length,
      });
    },

    canUndo: () => history.past.length > 0,
    canRedo: () => history.future.length > 0,


    setTheme: (theme) => {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      set({ theme });
    },

    setComparing: (value) => set({ comparing: value }),

    pushToast: (message, kind = 'info') => {
      toastSeq += 1;
      set({ toast: { id: toastSeq, message, kind } });
    },

    clearToast: () => set({ toast: null }),
  };
});

export const selectActiveImage = (state: EditorState): ImageItem | null =>
  state.images.find((item) => item.id === state.activeImageId) ?? null;

export const selectSelectedLayer = (state: EditorState): WatermarkLayer | null =>
  state.layers.find((layer) => layer.id === state.selectedId) ?? null;
