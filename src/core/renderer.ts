import { computeAnchors } from './geometry';
import { isLayoutLayer, isRedactLayer } from './layers';
import { breakText } from './textLayout';
import { resolveTokens } from './tokens';
import type {
  Ctx2D,
  ImageLayer,
  ImageSources,
  RedactLayer,
  Size,
  TextLayer,
  TextVars,
  WatermarkLayer,
} from './types';

export interface RenderRequest {
  width: number;
  height: number;
  layers: WatermarkLayer[];
  logos?: ImageSources;
  /** 文字变量：批量导出时按每张图传入 */
  vars?: TextVars;
}

const supportsLetterSpacing = (ctx: Ctx2D): boolean =>
  'letterSpacing' in (ctx as unknown as Record<string, unknown>);

const supportsFilter = (ctx: Ctx2D): boolean =>
  'filter' in (ctx as unknown as Record<string, unknown>);

function fontString(layer: TextLayer, fontPx: number): string {
  return `${layer.italic ? 'italic ' : ''}${layer.fontWeight} ${fontPx}px ${layer.fontFamily}`;
}

function sourceSize(source: CanvasImageSource): Size {
  const anySource = source as unknown as {
    naturalWidth?: number;
    naturalHeight?: number;
    videoWidth?: number;
    videoHeight?: number;
    width?: number;
    height?: number;
  };
  const width = anySource.naturalWidth ?? anySource.videoWidth ?? anySource.width ?? 0;
  const height = anySource.naturalHeight ?? anySource.videoHeight ?? anySource.height ?? 0;
  return { width: Number(width) || 1, height: Number(height) || 1 };
}

function roundRectPath(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/** 临时画布：Worker 与主线程通用 */
function createScratch(
  width: number,
  height: number,
): { source: CanvasImageSource; ctx: Ctx2D } | null {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (ctx) return { source: canvas, ctx: ctx as Ctx2D };
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) return { source: canvas, ctx };
  }
  return null;
}

/** 逐字排版，作为 letterSpacing 不受支持时的兜底 */
function fillLineWithSpacing(
  ctx: Ctx2D,
  line: string,
  centerX: number,
  baselineY: number,
  spacingPx: number,
  draw: (text: string, x: number, y: number) => void,
): void {
  const chars = Array.from(line);
  const widths = chars.map((char) => ctx.measureText(char).width);
  const total =
    widths.reduce((sum, width) => sum + width, 0) + spacingPx * Math.max(0, chars.length - 1);
  let cursor = centerX - total / 2;
  for (let i = 0; i < chars.length; i += 1) {
    draw(chars[i], cursor, baselineY);
    cursor += widths[i] + spacingPx;
  }
}

interface TextBlock {
  lines: string[];
  widths: number[];
  width: number;
  height: number;
  fontPx: number;
  lineHeight: number;
}

function layoutText(ctx: Ctx2D, layer: TextLayer, text: string, canvas: Size): TextBlock {
  const shortEdge = Math.min(canvas.width, canvas.height);
  const fontPx = Math.max(6, layer.fontSize * shortEdge);
  ctx.font = fontString(layer, fontPx);

  const spacingPx = layer.letterSpacing * fontPx;
  if (supportsLetterSpacing(ctx)) {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${spacingPx}px`;
  }

  const maxWidth = Math.min(canvas.width * 0.9, fontPx * 16);
  const lines = breakText(text, maxWidth, (value) => ctx.measureText(value).width);
  const widths = lines.map((line) => ctx.measureText(line).width);
  const lineHeight = fontPx * Math.max(0.8, layer.lineHeight);

  return {
    lines,
    widths,
    width: Math.max(1, ...widths),
    height: Math.max(lineHeight, lineHeight * lines.length),
    fontPx,
    lineHeight,
  };
}

function drawTextLayer(ctx: Ctx2D, layer: TextLayer, canvas: Size, text: string): void {
  const block = layoutText(ctx, layer, text, canvas);
  if (!block.lines.length) return;

  const padPx = layer.chip.enabled ? layer.chip.padding * block.fontPx : 0;
  const content: Size = {
    width: block.width + padPx * 2,
    height: block.height + padPx * 2,
  };

  const anchors = computeAnchors(layer.layout, canvas, content, layer.rotation);
  if (!anchors.length) return;

  const rad = (layer.rotation * Math.PI) / 180;
  const strokePx = layer.stroke.enabled ? Math.max(0.5, layer.stroke.width * block.fontPx) : 0;
  const topOffset = -content.height / 2;

  for (const anchor of anchors) {
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = layer.blend;
    ctx.translate(anchor.x, anchor.y);
    ctx.rotate(rad);

    if (layer.chip.enabled) {
      ctx.save();
      if (layer.shadow.enabled) {
        ctx.shadowColor = layer.shadow.color;
        ctx.shadowBlur = layer.shadow.blur * block.fontPx;
        ctx.shadowOffsetX = layer.shadow.offsetX * block.fontPx;
        ctx.shadowOffsetY = layer.shadow.offsetY * block.fontPx;
      }
      ctx.globalAlpha = layer.opacity * layer.chip.opacity;
      ctx.fillStyle = layer.chip.color;
      roundRectPath(
        ctx,
        -content.width / 2,
        -content.height / 2,
        content.width,
        content.height,
        layer.chip.radius * block.fontPx,
      );
      ctx.fill();
      ctx.restore();
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = layer.color;
    ctx.strokeStyle = layer.stroke.color;
    ctx.lineWidth = strokePx * 2;
    ctx.lineJoin = 'round';
    if (layer.shadow.enabled && !layer.chip.enabled) {
      ctx.shadowColor = layer.shadow.color;
      ctx.shadowBlur = layer.shadow.blur * block.fontPx;
      ctx.shadowOffsetX = layer.shadow.offsetX * block.fontPx;
      ctx.shadowOffsetY = layer.shadow.offsetY * block.fontPx;
    }

    const spacingPx = layer.letterSpacing * block.fontPx;
    const nativeSpacing = supportsLetterSpacing(ctx) && spacingPx !== 0;
    if (nativeSpacing) {
      (ctx as unknown as { letterSpacing: string }).letterSpacing = `${spacingPx}px`;
    }

    block.lines.forEach((line, index) => {
      if (!line) return;
      const baselineY = topOffset + padPx + block.lineHeight * (index + 0.5);
      const lineWidth = block.widths[index] ?? 0;

      if (nativeSpacing) {
        // 原生 letterSpacing：宽度已包含字距，交给 textAlign 居中
        ctx.textAlign = 'center';
        if (strokePx > 0) ctx.strokeText(line, 0, baselineY);
        ctx.fillText(line, 0, baselineY);
        ctx.textAlign = 'left';
      } else if (spacingPx === 0) {
        const centerX = -lineWidth / 2;
        if (strokePx > 0) ctx.strokeText(line, centerX, baselineY);
        ctx.fillText(line, centerX, baselineY);
      } else {
        fillLineWithSpacing(ctx, line, 0, baselineY, spacingPx, (char, x, y) => {
          if (strokePx > 0) ctx.strokeText(char, x, y);
          ctx.fillText(char, x, y);
        });
      }
    });

    ctx.restore();
  }
}

function drawImageLayer(ctx: Ctx2D, layer: ImageLayer, canvas: Size, logos: ImageSources): void {
  const source = logos[layer.id];
  if (!source) return;
  const natural = sourceSize(source);
  const targetWidth = layer.scale * Math.min(canvas.width, canvas.height);
  const content: Size = {
    width: targetWidth,
    height: (targetWidth * natural.height) / natural.width,
  };
  const anchors = computeAnchors(layer.layout, canvas, content, layer.rotation);
  const rad = (layer.rotation * Math.PI) / 180;

  for (const anchor of anchors) {
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = layer.blend;
    ctx.translate(anchor.x, anchor.y);
    ctx.rotate(rad);
    ctx.drawImage(
      source,
      -content.width / 2,
      -content.height / 2,
      content.width,
      content.height,
    );
    ctx.restore();
  }
}

/**
 * 打码：直接作用于当前画布像素（底图 + 先前打码区域），
 * 因此必须在文字 / Logo 之前执行，避免水印覆盖打码区造成信息泄露。
 */
function drawRedactLayer(ctx: Ctx2D, layer: RedactLayer, canvas: Size): void {
  if (!layer.regions.length) return;
  const shortEdge = Math.min(canvas.width, canvas.height);
  const canFilter = supportsFilter(ctx);

  for (const region of layer.regions) {
    const w = region.w * canvas.width;
    const h = region.h * canvas.height;
    if (w < 1 || h < 1) continue;
    const x = region.x * canvas.width;
    const y = region.y * canvas.height;
    const radius = Math.max(0, layer.radius * shortEdge);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.clip();

    const solidFallback = () => {
      ctx.globalAlpha = 1;
      ctx.fillStyle = layer.color;
      ctx.fillRect(x, y, w, h);
    };

    if (layer.mode === 'solid') {
      ctx.globalAlpha = Math.max(0.2, Math.min(1, layer.opacity));
      ctx.fillStyle = layer.color;
      ctx.fillRect(x, y, w, h);
    } else if (layer.mode === 'mosaic' || !canFilter) {
      // 不支持 filter 的浏览器把「模糊」降级为马赛克，确保打码一定有效
      const ratio = layer.mode === 'mosaic' ? layer.blockSize : layer.blurRadius * 2;
      const block = Math.max(2, ratio * shortEdge);
      const tw = Math.max(1, Math.round(w / block));
      const th = Math.max(1, Math.round(h / block));
      const scratch = createScratch(tw, th);
      if (!scratch) {
        solidFallback();
      } else {
        scratch.ctx.imageSmoothingEnabled = true;
        // 从画布自身取样缩小 → 关闭平滑再放大，形成像素块
        scratch.ctx.drawImage(ctx.canvas as CanvasImageSource, x, y, w, h, 0, 0, tw, th);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(scratch.source, 0, 0, tw, th, x, y, w, h);
        ctx.imageSmoothingEnabled = true;
      }
    } else {
      // 模糊：区域含外扩一起拷贝，再带滤镜 1:1 绘回，避免边缘发虚
      const blurPx = Math.max(4, layer.blurRadius * shortEdge);
      const pad = Math.ceil(blurPx * 2);
      const sx = Math.max(0, Math.floor(x - pad));
      const sy = Math.max(0, Math.floor(y - pad));
      const ex = Math.min(canvas.width, Math.ceil(x + w + pad));
      const ey = Math.min(canvas.height, Math.ceil(y + h + pad));
      const sw = Math.max(1, ex - sx);
      const sh = Math.max(1, ey - sy);
      const scratch = createScratch(sw, sh);
      if (!scratch) {
        solidFallback();
      } else {
        scratch.ctx.drawImage(ctx.canvas as CanvasImageSource, sx, sy, sw, sh, 0, 0, sw, sh);
        ctx.filter = `blur(${blurPx}px)`;
        ctx.drawImage(scratch.source, 0, 0, sw, sh, sx, sy, sw, sh);
        ctx.filter = 'none';
      }
    }

    ctx.restore();
  }
}

/** 在画布上绘制底图 + 全部可见水印图层 */
export function renderComposite(
  ctx: Ctx2D,
  source: CanvasImageSource,
  request: RenderRequest,
): void {
  const { width, height, layers, logos = {}, vars } = request;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  ctx.restore();

  const canvas: Size = { width, height };
  const visible = layers.filter((layer) => layer.visible);

  // 1) 打码层优先，作用于原始像素
  for (const layer of visible) {
    if (!isRedactLayer(layer)) continue;
    ctx.save();
    drawRedactLayer(ctx, layer, canvas);
    ctx.restore();
  }

  // 2) 水印层按图层顺序叠加
  for (const layer of visible) {
    if (!isLayoutLayer(layer)) continue;
    ctx.save();
    if (layer.type === 'text') {
      drawTextLayer(ctx, layer, canvas, resolveTokens(layer.text, vars));
    } else {
      drawImageLayer(ctx, layer, canvas, logos);
    }
    ctx.restore();
  }
}

export { sourceSize };
