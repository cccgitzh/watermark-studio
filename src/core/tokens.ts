import type { TextVars } from './types';

/** 水印文字可用的运行时变量 */
export const TEXT_TOKENS: { token: string; label: string }[] = [
  { token: '{date}', label: '日期' },
  { token: '{time}', label: '时间' },
  { token: '{datetime}', label: '日期+时间' },
  { token: '{filename}', label: '文件名' },
  { token: '{index}', label: '序号' },
  { token: '{total}', label: '总数' },
];

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * 把 {date} / {filename} 等占位符替换成运行时值。
 * 批量导出时每张图片单独解析，因此同一份配置可以自动带上各自的文件名与序号。
 */
export function resolveTokens(text: string, vars: TextVars = {}): string {
  if (!text || !text.includes('{')) return text;
  const now = vars.date ?? new Date();
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const fileName = (vars.fileName ?? '').replace(/\.[^./\\]+$/, '');

  return text
    .replace(/\{datetime\}/gi, `${date} ${time}`)
    .replace(/\{date\}/gi, date)
    .replace(/\{time\}/gi, time)
    .replace(/\{filename\}/gi, fileName)
    .replace(/\{index\}/gi, String((vars.index ?? 0) + 1))
    .replace(/\{total\}/gi, String(vars.total ?? 1));
}
