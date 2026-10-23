import { describe, expect, it } from 'vitest';
import {
  A4_MM,
  ID_CARD_MM,
  computePrintLayout,
  defaultPrintSettings,
  type PrintSettings,
} from '../src/core/print';

const settings = (patch: Partial<PrintSettings> = {}): PrintSettings => ({
  ...defaultPrintSettings,
  ...patch,
});

describe('A4 与证件尺寸', () => {
  it('A4 为 210 × 297 mm，证件为 85.6 × 54 mm（ID-1）', () => {
    expect(A4_MM).toEqual({ width: 210, height: 297 });
    expect(ID_CARD_MM).toEqual({ width: 85.6, height: 54 });
  });
});

describe('computePrintLayout · 上下排列', () => {
  it('反面紧接正面下方，间距计入', () => {
    const layout = computePrintLayout(settings({ gapMm: 12, marginMm: 16 }));
    expect(layout.cards[0]).toEqual({ x: 16, y: 16, w: 85.6, h: 54 });
    expect(layout.cards[1].x).toBe(16);
    expect(layout.cards[1].y).toBeCloseTo(16 + 54 + 12, 5);
    expect(layout.block).toEqual({ width: 85.6, height: 120 });
  });

  it('间距为 0 时两张紧贴但不重叠', () => {
    const layout = computePrintLayout(settings({ gapMm: 0 }));
    expect(layout.cards[1].y).toBeCloseTo(layout.cards[0].y + layout.cards[0].h, 5);
  });
});

describe('computePrintLayout · 并排', () => {
  it('反面贴在正面右侧，横向间距生效', () => {
    const layout = computePrintLayout(settings({ arrange: 'row', gapMm: 10, marginMm: 12 }));
    expect(layout.cards[0]).toEqual({ x: 12, y: 12, w: 85.6, h: 54 });
    expect(layout.cards[1].x).toBeCloseTo(12 + 85.6 + 10, 5);
    expect(layout.cards[1].y).toBe(12);
    expect(layout.block.width).toBeCloseTo(181.2, 5);
  });
});

describe('computePrintLayout · 居中', () => {
  it('居中时两侧留白相等', () => {
    const layout = computePrintLayout(settings({ align: 'center' }));
    const left = layout.cards[0].x;
    const right = A4_MM.width - (layout.cards[0].x + layout.block.width);
    expect(left).toBeCloseTo(right, 5);
  });

  it('页边距内装不下时退回靠页边，不做负向偏移', () => {
    const layout = computePrintLayout(
      settings({ align: 'center', arrange: 'row', gapMm: 30, marginMm: 16 }),
    );
    expect(layout.withinMargins).toBe(false);
    expect(layout.cards[0].x).toBe(16);
  });
});

describe('computePrintLayout · 尺寸与溢出', () => {
  it('尺寸按比例缩放卡片', () => {
    const layout = computePrintLayout(settings({ scale: 0.95 }));
    expect(layout.cards[0].w).toBeCloseTo(85.6 * 0.95, 5);
    expect(layout.cards[0].h).toBeCloseTo(54 * 0.95, 5);
  });

  it('超出纸张时标记为不通过并给出毫米数', () => {
    // 并排 + 70 mm 页边距：85.6×2 + 30 + 70 = 271.2 mm，超过 A4 的 210 mm
    const layout = computePrintLayout(
      settings({ arrange: 'row', marginMm: 70, gapMm: 30 }),
    );
    expect(layout.fits).toBe(false);
    expect(layout.warnings[0].level).toBe('error');
    expect(layout.warnings[0].text).toMatch(/\d+\.\d mm/);
  });

  it('超出页边距但仍在纸内：可打印，只提示留白不足', () => {
    const layout = computePrintLayout(settings({ arrange: 'row', marginMm: 10, gapMm: 20 }));
    expect(layout.fits).toBe(true);
    expect(layout.withinMargins).toBe(false);
    expect(layout.warnings[0].level).toBe('notice');
  });

  it('默认排版装得下且无警告', () => {
    const layout = computePrintLayout(settings());
    expect(layout.fits).toBe(true);
    expect(layout.withinMargins).toBe(true);
    expect(layout.warnings).toHaveLength(0);
  });
});

describe('computePrintLayout · 裁切线', () => {
  it('每张 8 条，共 16 条', () => {
    const layout = computePrintLayout(settings({ guides: true }));
    expect(layout.marks).toHaveLength(16);
  });

  it('裁切线落在卡片外侧 2 mm 处，不压住图片', () => {
    const layout = computePrintLayout(settings({ guides: true, marginMm: 20 }));
    const card = layout.cards[0];
    const horizontal = layout.marks.filter((mark) => mark.y1 === card.y);
    expect(horizontal[0].x2).toBeCloseTo(card.x - 2, 5);
    expect(horizontal[0].x1).toBeCloseTo(card.x - 5.5, 5);
  });

  it('页边距过小时不留下半截裁切线', () => {
    const layout = computePrintLayout(settings({ marginMm: 0, guides: true }));
    expect(layout.marks.length).toBeGreaterThan(0);
    expect(
      layout.marks.every(
        (mark) =>
          Math.min(mark.x1, mark.x2) >= 0 &&
          Math.max(mark.x1, mark.x2) <= A4_MM.width &&
          Math.min(mark.y1, mark.y2) >= 0 &&
          Math.max(mark.y1, mark.y2) <= A4_MM.height,
      ),
    ).toBe(true);
  });

  it('关闭后不产生任何线', () => {
    expect(computePrintLayout(settings({ guides: false })).marks).toHaveLength(0);
  });
});
