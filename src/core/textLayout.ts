/**
 * 文本换行：Canvas 没有内置的文本排版，这里实现一套适用于中英混排的贪心断行，
 * 并遵循中文排版的两条硬规则：
 *   1. 避头点 —— 逗号、句号、右括号等不能出现在行首（超宽时允许悬挂）；
 *   2. 避尾点 —— 左括号、左引号不能留在行尾。
 * 纯函数 + 注入 measure，便于单元测试（不依赖真实 canvas）。
 */

const LEADING_PUNCT = new Set(
  '，。！？；：、）》」』】〕…·—～,.!?;:)]}%‰”’'.split(''),
);

const TRAILING_PUNCT = new Set('（《「『【〔([{“‘'.split(''));

const CJK_RE =
  /[\u1100-\u11FF\u2E80-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;

export type TokenKind = 'word' | 'cjk' | 'space' | 'punct';

export interface Token {
  value: string;
  kind: TokenKind;
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let buffer = '';

  const flush = () => {
    if (buffer) {
      tokens.push({ value: buffer, kind: 'word' });
      buffer = '';
    }
  };

  for (const char of input) {
    if (char === ' ' || char === '\t') {
      flush();
      tokens.push({ value: ' ', kind: 'space' });
      continue;
    }
    if (CJK_RE.test(char)) {
      flush();
      const kind: TokenKind =
        LEADING_PUNCT.has(char) || TRAILING_PUNCT.has(char) ? 'punct' : 'cjk';
      tokens.push({ value: char, kind });
      continue;
    }
    if (LEADING_PUNCT.has(char) && !/[A-Za-z0-9]/.test(buffer)) {
      flush();
      tokens.push({ value: char, kind: 'punct' });
      continue;
    }
    buffer += char;
  }
  flush();
  return tokens;
}

/** 按字符硬切，用于单个超宽单词 */
function hardSplit(token: string, maxWidth: number, measure: (s: string) => number): string[] {
  const parts: string[] = [];
  let current = '';
  for (const char of token) {
    const next = current + char;
    if (current && measure(next) > maxWidth) {
      parts.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * @param text 原始文本（支持 \n 强制换行）
 * @param maxWidth 行宽上限（px）
 * @param measure 文本宽度测量函数
 */
export function breakText(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
): string[] {
  const safeWidth = Math.max(1, maxWidth);
  const paragraphs = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }

    const tokens = tokenize(paragraph);
    let current = '';
    let hasContent = false;

    const pushLine = (line: string) => {
      const trimmed = line.replace(/\s+$/, '');
      if (trimmed) lines.push(trimmed);
      current = '';
      hasContent = false;
    };

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];

      if (token.kind === 'space') {
        if (!hasContent) continue; // 行首空格丢弃
        current += token.value;
        continue;
      }

      const candidate = current + token.value;
      const width = measure(candidate);

      if (width <= safeWidth) {
        current = candidate;
        hasContent = true;
        continue;
      }

      // 避头点：即使超宽也挂在本行末尾
      if (hasContent && LEADING_PUNCT.has(token.value)) {
        current = candidate;
        continue;
      }

      if (!hasContent) {
        // 单个 token 超过整行宽度：硬切
        const parts = hardSplit(token.value, safeWidth, measure);
        if (parts.length > 1) {
          for (let p = 0; p < parts.length - 1; p += 1) lines.push(parts[p]);
        }
        current = parts[parts.length - 1] ?? '';
        hasContent = Boolean(current);
        continue;
      }

      // 避尾点：本行以左括号/左引号结尾时，把它推到下一行
      let carry = '';
      if (TRAILING_PUNCT.has(current.slice(-1)) && current.length > 1) {
        carry = current.slice(-1);
        current = current.slice(0, -1);
      }
      pushLine(current);
      current = carry + token.value;
      hasContent = true;
    }

    if (current.replace(/\s+$/, '')) pushLine(current);
  }

  const cleaned = lines.map((line) => line.replace(/\s+$/, ''));
  return cleaned.length ? cleaned : [''];
}
