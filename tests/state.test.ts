import { describe, expect, it } from 'vitest';
import { countPending, isReadyImage } from '../src/core/queue';
import type { ImageItem } from '../src/core/types';

const make = (patch: Partial<ImageItem> = {}): ImageItem => ({
  id: 'src_1',
  name: 'card.png',
  mime: 'image/png',
  size: 1024,
  width: 640,
  height: 400,
  bitmap: { width: 640, height: 400 } as unknown as ImageBitmap,
  skipped: false,
  status: 'ready',
  ...patch,
});

describe('isReadyImage', () => {
  it('正常图片算就绪', () => {
    expect(isReadyImage(make())).toBe(true);
  });

  it('读取失败的不算就绪，即使 bitmap 字段残留', () => {
    expect(isReadyImage(make({ status: 'failed' }))).toBe(false);
  });

  it('状态是 ready 但 bitmap 为空不算就绪', () => {
    expect(isReadyImage(make({ bitmap: null }))).toBe(false);
  });
});

describe('countPending', () => {
  const ready = make({ id: 'a' });
  const skipped = make({ id: 'b', skipped: true });
  const broken = make({ id: 'c', status: 'failed', bitmap: null, skipped: false });

  it('只统计可渲染且未跳过的图片', () => {
    expect(countPending([ready, skipped, broken])).toBe(1);
  });

  it('空队列为 0', () => {
    expect(countPending([])).toBe(0);
  });

  it('全部失败时为 0（导出按钮据此禁用）', () => {
    expect(countPending([broken])).toBe(0);
  });
});
