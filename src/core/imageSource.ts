export interface LoadedImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

/** 单张图片解码后的像素上限，防止超大图把移动端浏览器打爆 */
const MAX_EDGE = 8192;

export async function decodeImage(blob: Blob): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation: 'from-image' 让浏览器按 EXIF 方向自动转正
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return await normalize(bitmap);
    } catch {
      // 部分浏览器 / 格式（如 SVG、部分 BMP）不支持该选项，降级走 <img>
    }
  }
  return decodeWithElement(blob);
}

function normalize(bitmap: ImageBitmap): Promise<LoadedImage> | LoadedImage {
  const longEdge = Math.max(bitmap.width, bitmap.height);
  if (longEdge <= MAX_EDGE) {
    return { bitmap, width: bitmap.width, height: bitmap.height };
  }
  const ratio = MAX_EDGE / longEdge;
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  return createImageBitmap(bitmap, {
    resizeWidth: width,
    resizeHeight: height,
    resizeQuality: 'high',
  }).then((scaled) => {
    bitmap.close();
    return { bitmap: scaled, width, height };
  });
}

async function decodeWithElement(blob: Blob): Promise<LoadedImage> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('图片解码失败，可能是浏览器不支持的格式'));
      image.src = url;
    });
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const bitmap = await createImageBitmap(image);
    return { bitmap, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|bmp|avif|ico)$/i.test(file.name);
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

/** 把 File/Blob 转 dataURL，并限制长边，避免自定义配置过大 */
export async function blobToDataUrl(blob: Blob, maxEdge = 1024): Promise<string> {
  const loaded = await decodeImage(blob);
  const longEdge = Math.max(loaded.width, loaded.height);
  const ratio = longEdge > maxEdge ? maxEdge / longEdge : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(loaded.width * ratio));
  canvas.height = Math.max(1, Math.round(loaded.height * ratio));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布上下文');
  ctx.drawImage(loaded.bitmap, 0, 0, canvas.width, canvas.height);
  loaded.bitmap.close?.();
  return canvas.toDataURL('image/png');
}

export async function dataUrlToBitmap(dataUrl: string): Promise<ImageBitmap> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return createImageBitmap(blob);
}
