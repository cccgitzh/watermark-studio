import type { ImageLayer, LayoutLayer, RedactLayer, TextLayer, WatermarkLayer } from './types';

export const isTextLayer = (layer: WatermarkLayer): layer is TextLayer => layer.type === 'text';

export const isImageLayer = (layer: WatermarkLayer): layer is ImageLayer => layer.type === 'image';

export const isRedactLayer = (layer: WatermarkLayer): layer is RedactLayer =>
  layer.type === 'redact';

/** 参与排版（单点 / 平铺 / 网格）的图层：文字与 Logo */
export const isLayoutLayer = (layer: WatermarkLayer): layer is LayoutLayer =>
  layer.type === 'text' || layer.type === 'image';

export const layerKindLabel = (layer: WatermarkLayer): string => {
  if (layer.type === 'text') return '文字';
  if (layer.type === 'image') return 'Logo';
  return '打码';
};
