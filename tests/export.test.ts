import { describe, expect, it } from 'vitest';
import { buildFileName, extFromMime, resolveMime, stripExtension } from '../src/core/export';

describe('resolveMime', () => {
  it('original 保留常见源格式', () => {
    expect(resolveMime('original', 'image/jpeg')).toBe('image/jpeg');
    expect(resolveMime('original', 'image/png')).toBe('image/png');
    expect(resolveMime('original', 'image/webp')).toBe('image/webp');
  });

  it('GIF / SVG 统一转为 PNG（避免动图与矢量来源问题）', () => {
    expect(resolveMime('original', 'image/gif')).toBe('image/png');
    expect(resolveMime('original', 'image/svg+xml')).toBe('image/png');
  });

  it('未知来源回退 PNG，指定格式优先', () => {
    expect(resolveMime('original', 'application/octet-stream')).toBe('image/png');
    expect(resolveMime('jpeg', 'image/png')).toBe('image/jpeg');
  });
});

describe('extFromMime / stripExtension', () => {
  it('映射扩展名', () => {
    expect(extFromMime('image/jpeg')).toBe('jpg');
    expect(extFromMime('image/webp')).toBe('webp');
    expect(extFromMime('image/unknown')).toBe('png');
  });

  it('去掉扩展名但保留文件名中的点', () => {
    expect(stripExtension('IMG_2026.01.02.png')).toBe('IMG_2026.01.02');
    expect(stripExtension('noext')).toBe('noext');
  });
});

describe('buildFileName', () => {
  const context = {
    name: 'IMG_0001.JPG',
    index: 4,
    width: 1920,
    height: 1080,
    ext: 'jpg',
    date: new Date(2026, 9, 22),
  };

  it('替换全部占位符', () => {
    expect(buildFileName('{name}-{index}-{date}-{w}x{h}.{ext}', context)).toBe(
      'IMG_0001-005-20261022-1920x1080.jpg',
    );
  });

  it('模板为空时使用默认模板', () => {
    expect(buildFileName('', context)).toBe('IMG_0001-watermark.jpg');
  });

  it('过滤文件系统非法字符', () => {
    expect(buildFileName('a/b:c*?.{ext}', context)).toBe('a-b-c-.jpg');
  });

  it('即使模板不带扩展名也补齐', () => {
    expect(buildFileName('{name}-wm', context)).toBe('IMG_0001-wm.jpg');
  });

  it('模板全是非法字符时回退到原文件名', () => {
    expect(buildFileName('///', context)).toBe('IMG_0001.jpg');
  });
});
