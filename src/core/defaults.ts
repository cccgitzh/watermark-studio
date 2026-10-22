import type {
  Anchor9,
  BlendMode,
  ExportSettings,
  ImageLayer,
  LayoutConfig,
  Preset,
  RedactLayer,
  TextLayer,
  WatermarkLayer,
} from './types';

export const uid = (prefix = 'id'): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

export const FONT_OPTIONS: { label: string; value: string }[] = [
  {
    label: '无衬线（系统）',
    value: '"PingFang SC","Microsoft YaHei","Noto Sans SC","Helvetica Neue",Arial,sans-serif',
  },
  {
    label: '衬线 / 宋体',
    value: '"Songti SC","SimSun","Noto Serif SC",Georgia,serif',
  },
  { label: '楷体', value: '"Kaiti SC","KaiTi","STKaiti","Noto Serif SC",serif' },
  { label: '黑体', value: '"Heiti SC","SimHei","Noto Sans SC",sans-serif' },
  { label: '圆体', value: '"Yuanti SC","YouYuan","Hiragino Maru Gothic ProN",sans-serif' },
  { label: '等宽', value: 'ui-monospace,"SF Mono",Consolas,"Courier New",monospace' }, // taste-skill-ignore: user-chosen watermark face
  { label: 'Impact（标题）', value: 'Impact,"Arial Black","Haettenschweiler",sans-serif' },
  { label: 'Georgia（西文衬线）', value: 'Georgia,"Times New Roman",serif' },
];

export const ANCHOR_OPTIONS: { value: Anchor9; label: string }[] = [
  { value: 'top-left', label: '左上' },
  { value: 'top', label: '上中' },
  { value: 'top-right', label: '右上' },
  { value: 'left', label: '左中' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '右中' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom', label: '下中' },
  { value: 'bottom-right', label: '右下' },
];

export const BLEND_OPTIONS: { value: BlendMode; label: string }[] = [
  { value: 'source-over', label: '正常' },
  { value: 'multiply', label: '正片叠底' },
  { value: 'screen', label: '滤色' },
  { value: 'overlay', label: '叠加' },
  { value: 'soft-light', label: '柔光' },
  { value: 'difference', label: '差值' },
];

export const MAX_IMAGES = 60;
export const MAX_LAYERS = 8;

export const singleLayout = (anchor: Anchor9 = 'center'): LayoutConfig => ({
  mode: 'single',
  anchor,
  margin: 0.04,
  offsetX: 0,
  offsetY: 0,
});

export const tileLayout = (): LayoutConfig => ({
  mode: 'tile',
  gapX: 0.9,
  gapY: 1.8,
  stagger: false,
  padding: 0,
});

export const gridLayout = (): LayoutConfig => ({
  mode: 'grid',
  cols: 3,
  rows: 3,
  margin: 0.08,
});

export const createTextLayer = (patch: Partial<TextLayer> = {}): TextLayer => ({
  id: uid('txt'),
  type: 'text',
  name: '文字水印',
  visible: true,
  opacity: 0.24,
  rotation: -24,
  blend: 'source-over',
  layout: tileLayout(),
  text: '仅供办理业务使用',
  fontFamily: FONT_OPTIONS[0].value,
  fontWeight: 600,
  italic: false,
  fontSize: 0.042,
  letterSpacing: 0.04,
  lineHeight: 1.35,
  color: '#111111',
  shadow: { enabled: false, blur: 0.12, offsetX: 0, offsetY: 0.02, color: '#00000066' },
  stroke: { enabled: false, width: 0.02, color: '#ffffff' },
  chip: { enabled: false, color: '#ffffff', opacity: 0.86, padding: 0.32, radius: 0.3 },
  ...patch,
});

export const createImageLayer = (src: string, patch: Partial<ImageLayer> = {}): ImageLayer => ({
  id: uid('img'),
  type: 'image',
  name: 'Logo 水印',
  visible: true,
  opacity: 0.75,
  rotation: 0,
  blend: 'source-over',
  layout: singleLayout('bottom-right'),
  src,
  scale: 0.18,
  ...patch,
});

export const createRedactLayer = (patch: Partial<RedactLayer> = {}): RedactLayer => ({
  id: uid('rdt'),
  type: 'redact',
  name: '打码区域',
  visible: true,
  opacity: 1,
  rotation: 0,
  blend: 'source-over',
  mode: 'mosaic',
  regions: [
    { id: uid('rg'), x: 0.3, y: 0.4, w: 0.36, h: 0.08 },
  ],
  blockSize: 0.018,
  blurRadius: 0.02,
  color: '#111111',
  radius: 0.004,
  ...patch,
});

export const defaultExportSettings: ExportSettings = {
  format: 'original',
  quality: 0.92,
  maxSize: 0,
  nameTemplate: '{name}-watermark.{ext}',
  flattenColor: '#ffffff',
};

const withIds = (layers: WatermarkLayer[]): WatermarkLayer[] =>
  layers.map((layer) => ({ ...layer, id: uid(layer.type === 'text' ? 'txt' : 'img') }));

interface PresetSeed {
  id: string;
  name: string;
  layers: WatermarkLayer[];
  exportSettings?: Partial<ExportSettings>;
}

const presetSeeds: PresetSeed[] = [
  {
    id: 'preset-id-tile',
    name: '证件防盗用（斜向密铺）',
    layers: [
      createTextLayer({
        name: '证件防盗用',
        text: '仅供办理入职使用\n他用无效',
        rotation: -24,
        opacity: 0.22,
        fontSize: 0.038,
        fontWeight: 600,
        letterSpacing: 0.08,
        layout: { mode: 'tile', gapX: 1.1, gapY: 2.2, stagger: false, padding: 0.05 },
      }),
    ],
  },
  {
    id: 'preset-redact',
    name: '证件号打码（马赛克）',
    layers: [
      createRedactLayer({
        name: '证件号打码',
        mode: 'mosaic',
        blockSize: 0.016,
        radius: 0.004,
        regions: [
          { id: uid('rg'), x: 0.28, y: 0.335, w: 0.34, h: 0.055 },
          { id: uid('rg'), x: 0.28, y: 0.485, w: 0.26, h: 0.05 },
        ],
      }),
    ],
  },
  {
    id: 'preset-copyright',
    name: '版权角标（右下）',
    layers: [
      createTextLayer({
        name: '版权角标',
        text: '© 2026 Your Name',
        rotation: 0,
        opacity: 0.55,
        fontSize: 0.028,
        fontWeight: 500,
        letterSpacing: 0.02,
        color: '#ffffff',
        shadow: { enabled: true, blur: 0.16, offsetX: 0, offsetY: 0.02, color: '#00000099' },
        layout: { mode: 'single', anchor: 'bottom-right', margin: 0.035, offsetX: 0, offsetY: 0 },
      }),
    ],
  },
  {
    id: 'preset-center-title',
    name: '居中大字（草稿）',
    layers: [
      createTextLayer({
        name: '草稿',
        text: '草稿 · DRAFT',
        rotation: -18,
        opacity: 0.16,
        fontSize: 0.1,
        fontWeight: 800,
        letterSpacing: 0.02,
        layout: singleLayout('center'),
      }),
    ],
  },
  {
    id: 'preset-dense',
    name: '高密度防爬（细密纹）',
    layers: [
      createTextLayer({
        name: '防爬密纹',
        text: 'COPYRIGHT · 请勿转载',
        rotation: -30,
        opacity: 0.13,
        fontSize: 0.026,
        fontWeight: 500,
        letterSpacing: 0.1,
        layout: { mode: 'tile', gapX: 0.5, gapY: 0.9, stagger: true, padding: 0.02 },
      }),
    ],
  },
  {
    id: 'preset-label',
    name: '底部标签条',
    layers: [
      createTextLayer({
        name: '标签条',
        text: '内部资料 · 禁止外传',
        rotation: 0,
        opacity: 0.95,
        fontSize: 0.03,
        fontWeight: 500,
        color: '#1b1a17',
        chip: { enabled: true, color: '#ffffff', opacity: 0.9, padding: 0.42, radius: 0.34 },
        layout: { mode: 'single', anchor: 'bottom-left', margin: 0.04, offsetX: 0, offsetY: 0 },
      }),
    ],
  },
  {
    id: 'preset-archive',
    name: '归档编号（九宫格）',
    layers: [
      createTextLayer({
        name: '归档编号',
        text: 'ARCHIVE-2026',
        rotation: 0,
        opacity: 0.18,
        fontSize: 0.034,
        fontWeight: 600,
        layout: { mode: 'grid', cols: 3, rows: 3, margin: 0.1 },
      }),
    ],
  },
];

export const builtinPresets: Preset[] = presetSeeds.map((seed) => ({
  id: seed.id,
  name: seed.name,
  builtin: true,
  layers: withIds(seed.layers),
  exportSettings: seed.exportSettings,
}));

export const cloneDoc = <T>(value: T): T =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);
