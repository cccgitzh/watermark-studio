import { computeAnchors } from './geometry';
import { breakText } from './textLayout';
import type { Ctx2D, ImageLayer, ImageSources, Size, TextLayer, WatermarkLayer } from './types';

export interface RenderRequest {
  width: number;
  height: number;
  layers: WatermarkLayer[];
  logos?: ImageSources;
}

const supportsLetterSpacing = (ctx: Ctx2D): boolean =>
  'letterSpacing' in (ctx as unknown as Record<string, unknown>);

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

function layoutText(ctx: Ctx2D, layer: TextLayer, canvas: Size): TextBlock {
  const shortEdge = Math.min(canvas.width, canvas.height);
  const fontPx = Math.max(6, layer.fontSize * shortEdge);
  ctx.font = fontString(layer, fontPx);

  const spacingPx = layer.letterSpacing * fontPx;
  if (supportsLetterSpacing(ctx)) {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${spacingPx}px`;
  }

  const maxWidth = Math.min(canvas.width * 0.9, fontPx * 16);
  const lines = breakText(layer.text, maxWidth, (value) => ctx.measureText(value).width);
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

function drawTextLayer(ctx: Ctx2D, layer: TextLayer, canvas: Size): void {
  const block = layoutText(ctx, layer, canvas);
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

/** 在画布上绘制底图 + 全部可见水印图层 */
export function renderComposite(
  ctx: Ctx2D,
  source: CanvasImageSource,
  request: RenderRequest,
): void {
  const { width, height, layers, logos = {} } = request;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  ctx.restore();

  const canvas: Size = { width, height };
  for (const layer of layers) {
    if (!layer.visible) continue;
    ctx.save();
    if (layer.type === 'text') {
      drawTextLayer(ctx, layer, canvas);
    } else {
      drawImageLayer(ctx, layer, canvas, logos);
    }
    ctx.restore();
  }
}

export { sourceSize };
