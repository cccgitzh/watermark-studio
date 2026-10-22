import { describe, expect, it } from 'vitest';
import { breakText, tokenize } from '../src/core/textLayout';

/** 用等宽近似模拟 canvas.measureText：CJK 1em、拉丁字母 0.55em、空格 0.3em */
const measureWith = (em: number) => (value: string) => {
  let width = 0;
  for (const char of value) {
    if (/\s/.test(char)) width += em * 0.3;
    else if (/[\u3000-\u9FFF\uFF00-\uFFEF]/.test(char)) width += em;
    else width += em * 0.55;
  }
  return width;
};

describe('tokenize', () => {
  it('把中文逐字切分、拉丁词整体保留', () => {
    const tokens = tokenize('版权 2026 ABC');
    expect(tokens.map((token) => token.value)).toEqual(['版', '权', ' ', '2026', ' ', 'ABC']);
    expect(tokens.filter((token) => token.kind === 'word').map((token) => token.value)).toEqual([
      '2026',
      'ABC',
    ]);
  });
});

describe('breakText', () => {
  const measure = measureWith(10);

  it('保留显式换行', () => {
    expect(breakText('第一行\n第二行', 500, measure)).toEqual(['第一行', '第二行']);
  });

  it('超宽时按行宽折行', () => {
    const lines = breakText('仅供办理入职使用', 50, measure);
    // 每个汉字 10px，行宽 50px → 每行最多 5 字，共 8 字应折成 2 行
    expect(lines).toEqual(['仅供办理入', '职使用']);
    expect(lines.every((line) => measure(line) <= 50)).toBe(true);
  });

  it('逗号不出现在行首（避头点）', () => {
    const lines = breakText('请勿外传，谢谢配合', 50, measure);
    for (const line of lines.slice(1)) {
      expect(line.startsWith('，')).toBe(false);
    }
    expect(lines.join('')).toBe('请勿外传，谢谢配合');
  });

  it('左括号不留在行尾（避尾点）', () => {
    const lines = breakText('注意（重要提示）', 30, measure);
    for (const line of lines) {
      expect(line.endsWith('（')).toBe(false);
    }
  });

  it('拉丁单词不会被拆开', () => {
    // CONFIDENTIAL 宽 66px，加上空格与 D 会超过 70px，因此必须在空格处断开
    const lines = breakText('CONFIDENTIAL DRAFT', 70, measure);
    expect(lines).toEqual(['CONFIDENTIAL', 'DRAFT']);
  });

  it('超长单词按字符硬切', () => {
    const lines = breakText('SUPERCALIFRAGILISTIC', 50, measure);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => measure(line) <= 52)).toBe(true);
  });

  it('空文本返回单个空行而不是抛错', () => {
    expect(breakText('', 100, measure)).toEqual(['']);
    expect(breakText('   ', 100, measure)).toEqual(['']);
  });
});
