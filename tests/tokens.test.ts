import { describe, expect, it } from 'vitest';
import { resolveTokens } from '../src/core/tokens';

describe('resolveTokens', () => {
  const date = new Date(2026, 9, 22, 9, 5);

  it('替换日期与时间', () => {
    expect(resolveTokens('{date} {time}', { date })).toBe('2026-10-22 09:05');
    expect(resolveTokens('{datetime}', { date })).toBe('2026-10-22 09:05');
  });

  it('替换文件名（去掉扩展名）与序号', () => {
    expect(
      resolveTokens('{filename} #{index}/{total}', {
        fileName: 'IMG_2026.01.02.png',
        index: 2,
        total: 10,
        date,
      }),
    ).toBe('IMG_2026.01.02 #3/10');
  });

  it('大小写不敏感', () => {
    expect(resolveTokens('{DATE}', { date })).toBe('2026-10-22');
  });

  it('没有占位符时原样返回', () => {
    const text = '仅供办理业务使用';
    expect(resolveTokens(text)).toBe(text);
  });

  it('未知占位符保持原样，不会误替换', () => {
    expect(resolveTokens('{unknown} {date}', { date })).toBe('{unknown} 2026-10-22');
  });

  it('缺少变量时用空串或默认序号兜底', () => {
    expect(resolveTokens('{filename}|{index}|{total}')).toBe('|1|1');
  });
});
