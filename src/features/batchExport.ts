import { buildFileName, copyBlobToClipboard, downloadBlob, resolveMime, extFromMime } from '../core/export';
import { fitSize } from '../core/geometry';
import { dataUrlToBitmap } from '../core/imageSource';
import { useEditor, type ImageItem } from '../state/editorStore';
import { useBatchStore } from '../state/batchStore';
import { RenderPool, renderOnMainThread, type RenderJobInput } from '../workers/pool';
import type { WatermarkLayer } from '../core/types';

export type BatchMode = 'zip' | 'files' | 'current' | 'copy';

interface OutputItem {
  name: string;
  blob: Blob;
  width: number;
  height: number;
}

async function buildLogos(layers: WatermarkLayer[]): Promise<Record<string, ImageBitmap>> {
  const logos: Record<string, ImageBitmap> = {};
  for (const layer of layers) {
    if (layer.type !== 'image') continue;
    try {
      logos[layer.id] = await dataUrlToBitmap(layer.src);
    } catch {
      // 单个 Logo 解码失败不影响其它图层
    }
  }
  return logos;
}

function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let index = 2;
  let candidate = `${base}-${index}${ext}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${base}-${index}${ext}`;
  }
  used.add(candidate);
  return candidate;
}

function timestamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}`;
}

function describeTargets(mode: BatchMode, images: ImageItem[]): {
  mime: string;
  targets: ImageItem[];
} {
  const targets =
    mode === 'current' || mode === 'copy'
      ? images.slice(0, 1)
      : images.filter((item) => !item.skipped);
  const mime = mode === 'copy' ? 'image/png' : resolveMime('original', targets[0]?.mime ?? '');
  return { mime, targets };
}

export async function runBatch(mode: BatchMode): Promise<void> {
  const state = useEditor.getState();
  const settings = state.exportSettings;
  const activeImage = state.images.find((item) => item.id === state.activeImageId) ?? null;
  const sourceImages = mode === 'current' || mode === 'copy'
    ? activeImage
      ? [activeImage]
      : []
    : state.images;

  if (!sourceImages.length) {
    state.pushToast('请先添加图片', 'error');
    return;
  }

  const { targets } = describeTargets(mode, sourceImages);
  const visibleLayers = state.layers.filter((layer) => layer.visible);
  const useMainThread = state.customFonts.length > 0;

  const { setProgress, resetCancel } = useBatchStore.getState();
  resetCancel();
  setProgress({
    total: targets.length,
    done: 0,
    failed: 0,
    startedAt: Date.now(),
    label: mode === 'copy' ? '正在生成复制内容' : '正在渲染水印',
    phase: 'render',
  });

  const pool = new RenderPool(useMainThread ? 1 : 2);
  const logos = await buildLogos(visibleLayers);
  const results: OutputItem[] = [];
  const usedNames = new Set<string>();
  let failed = 0;
  let cursor = 0;

  const renderOne = async (item: ImageItem, index: number): Promise<void> => {
    const mime = mode === 'copy' ? 'image/png' : resolveMime(settings.format, item.mime);
    const size = fitSize({ width: item.width, height: item.height }, settings.maxSize);
    const job: RenderJobInput = {
      bitmap: item.bitmap,
      width: size.width,
      height: size.height,
      layers: visibleLayers,
      logos,
      vars: { fileName: item.name, index, total: targets.length },
      mime,
      quality: settings.quality,
      flattenColor: settings.flattenColor,
    };

    const output = useMainThread ? await renderOnMainThread(job) : await pool.render(job);
    const name = uniqueName(
      buildFileName(settings.nameTemplate, {
        name: item.name,
        index,
        width: size.width,
        height: size.height,
        ext: extFromMime(mime),
      }),
      usedNames,
    );
    results.push({ name, blob: output.blob, width: size.width, height: size.height });
  };

  const worker = async (): Promise<void> => {
    while (cursor < targets.length) {
      if (useBatchStore.getState().cancelRequested) return;
      const index = cursor;
      cursor += 1;
      const item = targets[index];
      try {
        await renderOne(item, index);
      } catch (error) {
        failed += 1;
        console.error('[watermark] render failed', item.name, error);
      }
      const progress = useBatchStore.getState().progress;
      if (progress) {
        setProgress({ ...progress, done: progress.done + 1, failed });
      }
    }
  };

  const concurrency = Math.min(useMainThread ? 1 : 2, targets.length);
  try {
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  } finally {
    pool.destroy();
  }

  const cancelled = useBatchStore.getState().cancelRequested;

  if (mode === 'copy') {
    setProgress(null);
    if (!results.length) {
      state.pushToast('复制失败，请重试', 'error');
      return;
    }
    try {
      await copyBlobToClipboard(results[0].blob);
      state.pushToast('已复制到剪贴板', 'success');
    } catch {
      state.pushToast('浏览器不允许写入剪贴板', 'error');
    }
    return;
  }

  if (!results.length) {
    setProgress(null);
    state.pushToast(cancelled ? '已取消' : '没有生成任何图片', 'error');
    return;
  }

  if (mode === 'current' || mode === 'files') {
    setProgress(null);
    for (let i = 0; i < results.length; i += 1) {
      downloadBlob(results[i].blob, results[i].name);
      if (results.length > 1) await new Promise((resolve) => setTimeout(resolve, 260));
    }
    state.pushToast(`已导出 ${results.length} 张图片`, 'success');
    return;
  }

  // ZIP：图片多为已压缩格式，直接 STORE 更快
  const current = useBatchStore.getState().progress;
  if (current) {
    setProgress({ ...current, phase: 'zip', label: '正在打包 ZIP' });
  }
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  results.forEach((item) => zip.file(item.name, item.blob));
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  setProgress(null);
  downloadBlob(zipBlob, `watermark-${timestamp()}.zip`);
  state.pushToast(
    failed > 0 ? `已导出 ${results.length} 张，${failed} 张失败` : `已打包 ${results.length} 张图片`,
    failed > 0 ? 'info' : 'success',
  );
}
