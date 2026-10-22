import { describe, expect, it } from 'vitest';
import { clamp, computeAnchors, fitSize } from '../src/core/geometry';
import type { LayoutConfig } from '../src/core/types';

const canvas = { width: 1000, height: 500 };
const content = { width: 200, height: 100 };

describe('computeAnchors - single', () => {
  const base: LayoutConfig = { mode: 'single', anchor: 'center', margin: 0.05, offsetX: 0, offsetY: 0 };

  it('居中锚点等于画布中心', () => {
    const [point] = computeAnchors(base, canvas, content, 0);
    expect(point).toEqual({ x: 500, y: 250 });
  });

  it('右下角按短边边距计算', () => {
    const [point] = computeAnchors({ ...base, anchor: 'bottom-right' }, canvas, content, 0);
    // 短边 500 * 0.05 = 25
    expect(point.x).toBe(1000 - 25 - 100);
    expect(point.y).toBe(500 - 25 - 50);
  });

  it('百分比偏移叠加在锚点上', () => {
    const [point] = computeAnchors({ ...base, offsetX: 0.1, offsetY: -0.2 }, canvas, content, 0);
    expect(point.x).toBeCloseTo(500 + 100);
    expect(point.y).toBeCloseTo(250 - 100);
  });
});

describe('computeAnchors - tile', () => {
  const layout: LayoutConfig = { mode: 'tile', gapX: 1, gapY: 1, stagger: false, padding: 0 };

  it('生成覆盖整块画布的锚点，且关于中心对称', () => {
    const points = computeAnchors(layout, canvas, content, 0);
    expect(points.length).toBeGreaterThan(4);
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(Math.max(...xs)).toBeGreaterThan(canvas.width);
    expect(Math.min(...ys)).toBeLessThan(0);
    expect(Math.max(...ys)).toBeGreaterThan(canvas.height);

    const centerX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
    expect(centerX).toBeCloseTo(canvas.width / 2, 4);
  });

  it('旋转 45° 后覆盖范围变大', () => {
    const plain = computeAnchors(layout, canvas, content, 0).length;
    const rotated = computeAnchors(layout, canvas, content, 45).length;
    expect(rotated).toBeGreaterThan(plain);
  });

  it('错行会改变第二行的起始位置', () => {
    const normal = computeAnchors(layout, canvas, content, 0);
    const staggered = computeAnchors({ ...layout, stagger: true }, canvas, content, 0);
    expect(normal).not.toEqual(staggered);
  });
});

describe('computeAnchors - grid', () => {
  it('行列数决定锚点数量', () => {
    const points = computeAnchors(
      { mode: 'grid', cols: 3, rows: 2, margin: 0.1 },
      canvas,
      content,
      0,
    );
    expect(points).toHaveLength(6);
    expect(points[0].x).toBeCloseTo(50 + (1000 - 100) / 3 / 2);
  });

  it('行列非法值被兜底为 1', () => {
    const points = computeAnchors(
      { mode: 'grid', cols: 0, rows: -1, margin: 0 },
      canvas,
      content,
      0,
    );
    expect(points).toHaveLength(1);
  });
});

describe('fitSize', () => {
  it('长边超限时等比缩放', () => {
    expect(fitSize({ width: 4000, height: 2000 }, 1000)).toEqual({ width: 1000, height: 500 });
  });

  it('不放大，0 表示原尺寸', () => {
    expect(fitSize({ width: 800, height: 600 }, 2000)).toEqual({ width: 800, height: 600 });
    expect(fitSize({ width: 800, height: 600 }, 0)).toEqual({ width: 800, height: 600 });
  });
});

describe('clamp', () => {
  it('限制到区间内并处理 NaN', () => {
    expect(clamp(1.5, 0, 1)).toBe(1);
    expect(clamp(-2, 0, 1)).toBe(0);
    expect(clamp(Number.NaN, 0.3, 1)).toBe(0.3);
  });
});
