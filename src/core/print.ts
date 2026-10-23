import type { ImageSources, WatermarkLayer } from './types';
import { renderComposite } from './renderer';

/**
 * A4 证件排版：把身份证正面与反面印到同一张纸上。
 *
 * 所有尺寸都用毫米计算，只在绘制时乘 pxPerMm —— 预览与打印走同一条几何，
 * 因此「预览里量到的位置」和「纸上量到的位置」是同一个数。
 */

export const A4_MM = { width: 210, height: 297 } as const;
/** ISO/IEC 7810 ID-1（身份证、银行卡通用） */
export const ID_CARD_MM = { width: 85.6, height: 54 } as const;
/** 打印分辨率：A4 → 2480 × 3508 px */
export const PRINT_DPI = 300;

export type PrintArrange = 'column' | 'row';
export type PrintAlign = 'start' | 'center';

export interface PrintSettings {
  /** column = 上下排（默认），row = 并排 */
  arrange: PrintArrange;
  /** 两张之间，毫米 */
  gapMm: number;
  /** 距页边，毫米 */
  marginMm: number;
  /** 相对实际尺寸的比例，1 = 100% */
  scale: number;
  align: PrintAlign;
  /** 裁切线 */
  guides: boolean;
  /** 卡片细边（浅灰，仅便于对位） */
  border: boolean;
  /** 带当前水印 */
  watermark: boolean;
  /** 50 mm 校准尺 */
  ruler: boolean;
}

export const defaultPrintSettings: PrintSettings = {
  arrange: 'column',
  gapMm: 12,
  marginMm: 16,
  scale: 1,
  align: 'start',
  guides: true,
  border: false,
  watermark: true,
  ruler: false,
};

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PrintWarning {
  level: 'error' | 'notice';
  text: string;
}

export interface PrintLayout {
  page: { width: number; height: number };
  /** [正面, 反面] */
  cards: [Box, Box];
  marks: Segment[];
  block: { width: number; height: number };
  /** 在纸张范围内：超出就会被打印机裁掉 */
  fits: boolean;
  /** 在页边距范围内：超出仍能打印，只是留白不足 */
  withinMargins: boolean;
  warnings: PrintWarning[];
}

const MARK_OFFSET = 2;
const MARK_LENGTH = 3.5;

const cornerMarks = (box: Box): Segment[] => {
  const { x, y, w, h } = box;
  const right = x + w;
  const bottom = y + h;
  const o = MARK_OFFSET;
  const l = MARK_LENGTH;
  return [
    // 左上
    { x1: x - o - l, y1: y, x2: x - o, y2: y },
    { x1: x, y1: y - o - l, x2: x, y2: y - o },
    // 右上
    { x1: right + o, y1: y, x2: right + o + l, y2: y },
    { x1: right, y1: y - o - l, x2: right, y2: y - o },
    // 左下
    { x1: x - o - l, y1: bottom, x2: x - o, y2: bottom },
    { x1: x, y1: bottom + o, x2: x, y2: bottom + o + l },
    // 右下
    { x1: right + o, y1: bottom, x2: right + o + l, y2: bottom },
    { x1: right, y1: bottom + o, x2: right, y2: bottom + o + l },
  ];
};

export function computePrintLayout(settings: PrintSettings): PrintLayout {
  const cardW = ID_CARD_MM.width * settings.scale;
  const cardH = ID_CARD_MM.height * settings.scale;
  const block =
    settings.arrange === 'row'
      ? { width: cardW * 2 + settings.gapMm, height: cardH }
      : { width: cardW, height: cardH * 2 + settings.gapMm };

  const availW = A4_MM.width - settings.marginMm * 2;
  const availH = A4_MM.height - settings.marginMm * 2;
  const withinMarginsW = block.width <= availW + 1e-6;
  const withinMarginsH = block.height <= availH + 1e-6;
  const withinMargins = withinMarginsW && withinMarginsH;
  const fits =
    settings.marginMm + block.width <= A4_MM.width + 1e-6 &&
    settings.marginMm + block.height <= A4_MM.height + 1e-6;

  // 居中只在页边距内装得下时生效；装不下就从页边距开始，并把溢出方向告诉用户
  const centered = settings.align === 'center' && withinMargins;
  const originX = centered ? settings.marginMm + (availW - block.width) / 2 : settings.marginMm;
  const originY = centered ? settings.marginMm + (availH - block.height) / 2 : settings.marginMm;

  const cards: [Box, Box] =
    settings.arrange === 'row'
      ? [
          { x: originX, y: originY, w: cardW, h: cardH },
          { x: originX + cardW + settings.gapMm, y: originY, w: cardW, h: cardH },
        ]
      : [
          { x: originX, y: originY, w: cardW, h: cardH },
          { x: originX, y: originY + cardH + settings.gapMm, w: cardW, h: cardH },
        ];

  const warnings: PrintWarning[] = [];
  const overW = Math.max(0, settings.marginMm + block.width - A4_MM.width);
  const overH = Math.max(0, settings.marginMm + block.height - A4_MM.height);
  if (!fits) {
    warnings.push({
      level: 'error',
      text: `超出纸张约 ${formatMm(Math.max(overW, overH))} mm，超出部分会被裁掉`,
    });
  } else if (!withinMargins) {
    warnings.push({
      level: 'notice',
      text: '下边缘留白不足，仍可完整打印',
    });
  }

  // 页边距很小时，卡片外侧的裁切线会跑到纸外：这类线直接丢掉，不印半截
  const insidePage = (mark: Segment): boolean =>
    Math.min(mark.x1, mark.x2) >= 0.5 &&
    Math.max(mark.x1, mark.x2) <= A4_MM.width - 0.5 &&
    Math.min(mark.y1, mark.y2) >= 0.5 &&
    Math.max(mark.y1, mark.y2) <= A4_MM.height - 0.5;

  return {
    page: { width: A4_MM.width, height: A4_MM.height },
    cards,
    marks: settings.guides ? cards.flatMap(cornerMarks).filter(insidePage) : [],
    block,
    fits,
    withinMargins,
    warnings,
  };
}

/** 一张卡片上的坐标（毫米，保留 1 位） */
export const formatMm = (value: number): string => `${value.toFixed(1)}`;

export interface DrawCardSource {
  source: CanvasImageSource | null;
}

export interface DrawSheetOptions {
  pxPerMm: number;
  cards: [DrawCardSource, DrawCardSource];
  border: boolean;
  guides: boolean;
  ruler: boolean;
}

const drawImageContain = (
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  box: Box,
): void => {
  const sw = Number((source as { width?: number }).width) || 0;
  const sh = Number((source as { height?: number }).height) || 0;
  if (!sw || !sh) return;
  const ratio = Math.min(box.w / sw, box.h / sh);
  const w = sw * ratio;
  const h = sh * ratio;
  ctx.drawImage(source, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
};

/** 把排版画到任意画布：预览用小比例，打印用 300 DPI，几何一致 */
export function drawPrintSheet(
  ctx: CanvasRenderingContext2D,
  layout: PrintLayout,
  options: DrawSheetOptions,
): void {
  const { pxPerMm } = options;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, layout.page.width * pxPerMm, layout.page.height * pxPerMm);
  ctx.scale(pxPerMm, pxPerMm);

  layout.cards.forEach((box, index) => {
    const source = options.cards[index]?.source;
    if (!source) {
      // 缺图时用一条浅色提示线占位，打印出来也知道这里该放什么
      ctx.save();
      ctx.strokeStyle = '#c9cdcc';
      ctx.lineWidth = 0.25;
      ctx.setLineDash([2, 1.5]);
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      ctx.restore();
      return;
    }
    // 留白由纸张自带的白底承担，图片按比例完整放入，不裁切
    drawImageContain(ctx, source, box);
    if (options.border) {
      ctx.save();
      ctx.strokeStyle = '#d4d7d6';
      ctx.lineWidth = 0.2;
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      ctx.restore();
    }
  });

  if (options.guides && layout.marks.length) {
    ctx.save();
    ctx.strokeStyle = '#9aa09f';
    ctx.lineWidth = 0.22;
    ctx.beginPath();
    layout.marks.forEach((mark) => {
      ctx.moveTo(mark.x1, mark.y1);
      ctx.lineTo(mark.x2, mark.y2);
    });
    ctx.stroke();
    ctx.restore();
  }

  if (options.ruler) {
    const length = 50;
    const x = layout.page.width - 16 - length;
    const y = layout.page.height - 12;
    ctx.save();
    ctx.strokeStyle = '#5b6164';
    ctx.fillStyle = '#5b6164';
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y);
    for (let mm = 0; mm <= length; mm += 10) {
      ctx.moveTo(x + mm, y - (mm % 50 === 0 || mm === 0 ? 2.2 : 1.4));
      ctx.lineTo(x + mm, y);
    }
    ctx.stroke();
    ctx.font = '3px "IBM Plex Mono", ui-monospace, monospace'; // taste-skill-ignore: ruler label in canvas
    ctx.textBaseline = 'bottom';
    ctx.fillText('50 mm 校准尺 · 量到 50 才算 100%', x, y - 3.4);
    ctx.restore();
  }

  ctx.restore();
}

/** 卡片内容合成：先按比例放进卡片画布，再叠当前水印 */
export async function composePrintCard(
  source: CanvasImageSource,
  width: number,
  height: number,
  layers: WatermarkLayer[],
  logos: ImageSources,
  vars: { fileName?: string },
): Promise<ImageBitmap> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建卡片画布');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  drawImageContain(ctx, source, { x: 0, y: 0, w: width, h: height });

  const visible = layers.filter((layer) => layer.visible);
  if (visible.length) {
    const base = await createImageBitmap(canvas);
    renderComposite(ctx, base, { width, height, layers: visible, logos, vars });
    base.close();
  }
  return createImageBitmap(canvas);
}

/** 300 DPI 下卡片画布的像素尺寸 */
export const cardPixels = (): { width: number; height: number } => ({
  width: Math.round(ID_CARD_MM.width * (PRINT_DPI / 25.4)),
  height: Math.round(ID_CARD_MM.height * (PRINT_DPI / 25.4)),
});
