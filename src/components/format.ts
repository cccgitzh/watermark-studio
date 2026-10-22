export const pct = (value: number, digits = 0): string => `${(value * 100).toFixed(digits)}%`;

export const deg = (value: number): string => `${Math.round(value)}°`;

export const fixed = (value: number, digits = 2): string => value.toFixed(digits);

export const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
