import type { ExportFormat } from './types';

export const MIME_BY_FORMAT: Record<Exclude<ExportFormat, 'original'>, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
  'image/svg+xml': 'png',
};

/** 导出格式 → 实际 MIME；original 优先保留源格式（GIF 动图等除外） */
export function resolveMime(format: ExportFormat, sourceMime: string): string {
  if (format === 'original') {
    const known = EXT_BY_MIME[sourceMime];
    if (known && sourceMime !== 'image/gif' && sourceMime !== 'image/svg+xml') return sourceMime;
    return 'image/png';
  }
  return MIME_BY_FORMAT[format];
}

export function extFromMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? 'png';
}

/** 去掉扩展名，用于 {name} 占位符 */
export function stripExtension(name: string): string {
  return name.replace(/\.[^./\\]+$/, '');
}

export interface FileNameContext {
  name: string;
  index: number;
  width: number;
  height: number;
  ext: string;
  date?: Date;
}

const pad = (value: number) => String(value).padStart(2, '0');

export function buildFileName(template: string, context: FileNameContext): string {
  const date = context.date ?? new Date();
  const dateToken = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const base = stripExtension(context.name);
  const raw = (template || '{name}-watermark.{ext}')
    .replace(/\{name\}/gi, base)
    .replace(/\{index\}/gi, String(context.index + 1).padStart(3, '0'))
    .replace(/\{date\}/gi, dateToken)
    .replace(/\{w\}/gi, String(context.width))
    .replace(/\{h\}/gi, String(context.height))
    .replace(/\{ext\}/gi, context.ext);

  // 去掉文件系统非法字符与控制字符
  const safe = raw
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .replace(/^[\s.-]+|[\s.]+$/g, '');

  const fallback = base || 'image';
  const withoutExt = safe.replace(/\.(png|jpe?g|webp|gif|bmp|avif)$/i, '');
  const ext = context.ext || 'png';
  return `${withoutExt || fallback}.${ext}`;
}

export async function encodeCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  mime: string,
  quality: number,
): Promise<Blob> {
  const safeQuality = Math.min(1, Math.max(0.1, quality));
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({
      type: mime,
      quality: mime === 'image/png' ? undefined : safeQuality,
    });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片编码失败'))),
      mime,
      mime === 'image/png' ? undefined : safeQuality,
    );
  });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function copyBlobToClipboard(blob: Blob): Promise<void> {
  const withClipboard = window as Window & { ClipboardItem?: typeof ClipboardItem };
  if (!navigator.clipboard || !withClipboard.ClipboardItem) {
    throw new Error('当前浏览器不支持写入剪贴板');
  }
  const type = blob.type === 'image/png' ? blob.type : 'image/png';
  await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '--';
  if (ms < 1000) return '<1 秒';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}
