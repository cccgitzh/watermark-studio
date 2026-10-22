/**
 * 领域模型：水印文档由「图层」组成。
 * 所有尺寸类参数一律用「相对比例」而非绝对像素，保证同一份配置在
 * 缩略图预览、原始尺寸导出、以及不同分辨率的批量图片上视觉一致。
 */

export type LayerType = 'text' | 'image' | 'redact';

export type BlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'difference';

export type Anchor9 =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';

/** 单点定位：九宫格 + 百分比偏移 + 边距 */
export interface SingleLayout {
  mode: 'single';
  anchor: Anchor9;
  /** 边距，相对画布短边的比例 */
  margin: number;
  /** 偏移，相对画布宽/高的比例（-0.5 ~ 0.5） */
  offsetX: number;
  offsetY: number;
}

/** 平铺：可独立控制横纵间距与错行 */
export interface TileLayout {
  mode: 'tile';
  /** 水平间距，相对水印自身宽度的比例 */
  gapX: number;
  /** 垂直间距，相对水印自身高度的比例 */
  gapY: number;
  stagger: boolean;
  /** 平铺区扩边，避免旋转后四角漏印 */
  padding: number;
}

/** 网格：固定行列数，均分画布 */
export interface GridLayout {
  mode: 'grid';
  cols: number;
  rows: number;
  margin: number;
}

export type LayoutConfig = SingleLayout | TileLayout | GridLayout;

export interface ShadowConfig {
  enabled: boolean;
  /** 相对字号的比例 */
  blur: number;
  offsetX: number;
  offsetY: number;
  color: string;
}

export interface StrokeConfig {
  enabled: boolean;
  /** 相对字号的比例（描边外扩宽度） */
  width: number;
  color: string;
}

/** 文字背景块（标签条效果） */
export interface ChipConfig {
  enabled: boolean;
  color: string;
  opacity: number;
  /** 相对字号的比例 */
  padding: number;
  radius: number;
}

export interface BaseLayer {
  id: string;
  type: LayerType;
  name: string;
  visible: boolean;
  /** 0 ~ 1 */
  opacity: number;
  /** 角度，顺时针为正 */
  rotation: number;
  blend: BlendMode;
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  layout: LayoutConfig;
  text: string;
  /** CSS font-family 列表 */
  fontFamily: string;
  fontWeight: number;
  italic: boolean;
  /** 字号，相对画布短边的比例 */
  fontSize: number;
  /** 字距，相对字号的比例（em） */
  letterSpacing: number;
  /** 行高倍数 */
  lineHeight: number;
  color: string;
  shadow: ShadowConfig;
  stroke: StrokeConfig;
  chip: ChipConfig;
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  layout: LayoutConfig;
  /** data URL，仅存于内存与配置文件中 */
  src: string;
  /** 宽度，相对画布短边的比例 */
  scale: number;
}

export type RedactMode = 'mosaic' | 'blur' | 'solid';

/** 打码区域，全部使用相对画布的 0~1 比例 */
export interface RedactRegion {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RedactLayer extends BaseLayer {
  type: 'redact';
  mode: RedactMode;
  regions: RedactRegion[];
  /** mosaic：色块边长 / blur：模糊半径 / solid：填充色 */
  blockSize: number;
  blurRadius: number;
  color: string;
  /** 区域圆角，相对画布短边 */
  radius: number;
}

export type WatermarkLayer = TextLayer | ImageLayer | RedactLayer;
/** 参与排版（单点 / 平铺 / 网格）的图层 */
export type LayoutLayer = TextLayer | ImageLayer;

export type ExportFormat = 'original' | 'png' | 'jpeg' | 'webp';

export interface ExportSettings {
  format: ExportFormat;
  /** 0.4 ~ 1 */
  quality: number;
  /** 长边上限，0 表示不缩放 */
  maxSize: number;
  /** 文件名模板，支持 {name} {index} {date} {w} {h} {ext} */
  nameTemplate: string;
  /** JPEG 无透明通道时的底色 */
  flattenColor: string;
}

export interface DocumentState {
  layers: WatermarkLayer[];
  exportSettings: ExportSettings;
}

/** 一份可直接序列化的完整方案 */
export interface Preset {
  id: string;
  name: string;
  builtin?: boolean;
  layers: WatermarkLayer[];
  exportSettings?: Partial<ExportSettings>;
}

/** 文字水印运行时变量（批量导出时按每张图解析） */
export interface TextVars {
  fileName?: string;
  index?: number;
  total?: number;
  date?: Date;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** 2D 上下文最小接口，主线程与 OffscreenCanvas 共用渲染器 */
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export type ImageSources = Record<string, CanvasImageSource>;
