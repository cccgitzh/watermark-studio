import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  A4_MM,
  ID_CARD_MM,
  PRINT_DPI,
  cardPixels,
  composePrintCard,
  computePrintLayout,
  drawPrintSheet,
  formatMm,
} from '../core/print';
import type { ImageItem } from '../core/types';
import { useLogoImages } from '../hooks/useLogoImages';
import { isReadyImage, useEditor } from '../state/editorStore';
import { usePrint, type PrintSlot } from '../state/printStore';
import { Segmented, Slider, SwitchRow } from './controls';
import { IconClose, IconImage, IconPrint } from './icons';

/** 预览按 2.2 px/mm 画，再由 CSS 缩放到面板宽度 —— 缩放不会引入位置误差 */
const PREVIEW_PX_PER_MM = 2.2;

function SlotThumb({ item }: { item: ImageItem | null }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!item?.bitmap) return;
    const ratio = Math.min(canvas.width / item.width, canvas.height / item.height);
    const w = item.width * ratio;
    const h = item.height * ratio;
    ctx.drawImage(item.bitmap, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }, [item]);

  if (!item) {
    return (
      <span className="print-slot-empty" aria-hidden="true">
        <IconImage size={14} />
      </span>
    );
  }
  return <canvas ref={ref} width={112} height={72} className="print-slot-canvas" />;
}

function PrintSheetDialog({ onClose }: { onClose: () => void }) {
  const images = useEditor((state) => state.images);
  const layers = useEditor((state) => state.layers);
  const frontId = usePrint((state) => state.frontId);
  const backId = usePrint((state) => state.backId);
  const settings = usePrint((state) => state.settings);
  const assign = usePrint((state) => state.assign);
  const patch = usePrint((state) => state.patch);
  const resetSettings = usePrint((state) => state.resetSettings);
  const logos = useLogoImages(layers);

  const ready = useMemo(() => images.filter(isReadyImage), [images]);
  const front = ready.find((item) => item.id === frontId) ?? null;
  const back = ready.find((item) => item.id === backId) ?? null;
  const layout = useMemo(() => computePrintLayout(settings), [settings]);

  const [cards, setCards] = useState<{ front: ImageBitmap | null; back: ImageBitmap | null }>({
    front: null,
    back: null,
  });
  const [busy, setBusy] = useState(false);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const printRef = useRef<HTMLCanvasElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // 卡片内容：原图按比例放入卡片画布，再叠当前水印
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const size = cardPixels();

    const build = async (item: ImageItem | null): Promise<ImageBitmap | null> => {
      if (!item?.bitmap) return null;
      if (!settings.watermark) return item.bitmap;
      try {
        return await composePrintCard(item.bitmap, size.width, size.height, layers, logos, {
          fileName: item.name,
        });
      } catch {
        return item.bitmap;
      }
    };

    void Promise.all([build(front), build(back)]).then(([frontCard, backCard]) => {
      if (cancelled) return;
      setCards({ front: frontCard, back: backCard });
      setBusy(false);
    });

    return () => {
      cancelled = true;
    };
  }, [front, back, layers, logos, settings.watermark]);

  // 屏幕预览
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pxPerMm = PREVIEW_PX_PER_MM * dpr;
    canvas.width = Math.round(layout.page.width * pxPerMm);
    canvas.height = Math.round(layout.page.height * pxPerMm);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawPrintSheet(ctx, layout, {
      pxPerMm,
      cards: [{ source: cards.front }, { source: cards.back }],
      border: settings.border,
      guides: settings.guides,
      ruler: settings.ruler,
    });
  }, [layout, cards, settings.border, settings.guides, settings.ruler]);

  // 打印画布：同一套几何，只换 pxPerMm。
  // 平时用低分辨率垫着（避免 Ctrl+P 时是一张空白纸），真正打印前再按 300 DPI 重画。
  const paintPrint = useCallback(
    (pxPerMm: number) => {
      const canvas = printRef.current;
      if (!canvas) return;
      canvas.width = Math.round(layout.page.width * pxPerMm);
      canvas.height = Math.round(layout.page.height * pxPerMm);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawPrintSheet(ctx, layout, {
        pxPerMm,
        cards: [{ source: cards.front }, { source: cards.back }],
        border: settings.border,
        guides: settings.guides,
        ruler: settings.ruler,
      });
    },
    [layout, cards, settings.border, settings.guides, settings.ruler],
  );

  useEffect(() => {
    paintPrint(PRINT_DPI / 25.4 / 3);
  }, [paintPrint]);

  useEffect(() => {
    const onBeforePrint = () => paintPrint(PRINT_DPI / 25.4);
    window.addEventListener('beforeprint', onBeforePrint);
    // 某些路径（打印预览、存为 PDF）只切换媒体查询而不发 beforeprint
    const media = window.matchMedia('print');
    const onMediaChange = (event: MediaQueryListEvent) => {
      if (event.matches) paintPrint(PRINT_DPI / 25.4);
    };
    media.addEventListener('change', onMediaChange);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      media.removeEventListener('change', onMediaChange);
    };
  }, [paintPrint]);

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      returnFocusRef.current?.focus?.();
    };
  }, []);

  // 弹层内 Tab 循环，焦点不会跑到背后的画布上
  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const root = dialogRef.current;
    if (!root) return;
    const list = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button:not(:disabled), select:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.offsetParent !== null);
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handlePrint = async () => {
    paintPrint(PRINT_DPI / 25.4);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    window.print();
  };

  const slot = (key: PrintSlot, item: ImageItem | null, label: string) => (
    <div className="print-slot">
      <SlotThumb item={item} />
      <div className="print-slot-text">
        <span className="print-slot-label">{label}</span>
        <span className="print-slot-name" title={item?.name}>
          {item ? item.name : '未选择'}
        </span>
      </div>
      <select
        className="print-slot-select"
        aria-label={`选择${label}图片`}
        value={item?.id ?? ''}
        onChange={(event) => assign(key, event.target.value || null)}
      >
        <option value="">未选择</option>
        {ready.map((option, order) => (
          <option key={option.id} value={option.id}>
            {order + 1}. {option.name}
          </option>
        ))}
      </select>
    </div>
  );

  const scaleText = `${Math.round(settings.scale * 100)}%`;

  return createPortal(
    <>
      <div
        className="print-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-sheet-title"
        onClick={onClose}
      >
        <div
          ref={dialogRef}
          className="print-dialog"
          onKeyDown={trapFocus}
          onClick={(event) => event.stopPropagation()}
        >
          <header className="print-head">
            <div className="print-head-text">
              <h2 className="print-title" id="print-sheet-title">
                打印身份证 · A4 单页
              </h2>
              <p className="print-sub">
                正反面 1:1 同页 · 证件 {ID_CARD_MM.width} × {ID_CARD_MM.height} mm
              </p>
            </div>
            <div className="print-head-actions">
              <button type="button" className="button button-sm button-ghost" onClick={resetSettings}>
                恢复默认
              </button>
              <button
                ref={closeRef}
                type="button"
                className="icon-button"
                title="关闭（Esc）"
                onClick={onClose}
              >
                <IconClose size={16} />
              </button>
            </div>
          </header>

          <div className="print-body">
            <div className="print-stage">
              <div className="print-page">
                <canvas ref={previewRef} className="print-canvas" />
              </div>
              <div className="print-caption">
                <p>
                  A4 {A4_MM.width} × {A4_MM.height} mm
                  <span className="dot" aria-hidden="true" />
                  1:1 绘制
                  <span className="dot" aria-hidden="true" />
                  {busy ? '正在合成…' : `${PRINT_DPI} DPI`}
                </p>
                <p className="print-caption-coords">
                  正面 左 {formatMm(layout.cards[0].x)} · 上 {formatMm(layout.cards[0].y)}
                  <span className="dot" aria-hidden="true" />
                  反面 左 {formatMm(layout.cards[1].x)} · 上 {formatMm(layout.cards[1].y)}
                  <span className="dot" aria-hidden="true" />
                  成品 {formatMm(layout.block.width)} × {formatMm(layout.block.height)} mm
                </p>
              </div>
            </div>

            <aside className="print-side">
              <div className="print-scroll">
                <section className="print-block">
                  <h3 className="print-block-title">两面</h3>
                  {slot('front', front, '正面')}
                  {slot('back', back, '反面')}
                  {ready.length < 2 ? (
                    <p className="print-hint">
                      队列里只有 {ready.length} 张可用图片，先关闭面板补一张反面照片。
                    </p>
                  ) : null}
                </section>

                <section className="print-block">
                  <h3 className="print-block-title">版面</h3>
                  <div className="print-row">
                    <span className="print-label">排列</span>
                    <Segmented
                      value={settings.arrange}
                      ariaLabel="排列方式"
                      options={[
                        { value: 'column', label: '上下' },
                        { value: 'row', label: '并排' },
                      ]}
                      onChange={(value) => patch({ arrange: value })}
                    />
                  </div>
                  <div className="print-row">
                    <span className="print-label">位置</span>
                    <Segmented
                      value={settings.align}
                      ariaLabel="页面位置"
                      options={[
                        { value: 'start', label: '贴页边' },
                        { value: 'center', label: '居中' },
                      ]}
                      onChange={(value) => patch({ align: value })}
                    />
                  </div>
                  <Slider
                    label="两张间距"
                    value={settings.gapMm}
                    min={0}
                    max={40}
                    step={1}
                    format={(value) => `${value} mm`}
                    onChange={(value) => patch({ gapMm: value })}
                  />
                  <Slider
                    label="页边距"
                    value={settings.marginMm}
                    min={0}
                    max={50}
                    step={1}
                    format={(value) => `${value} mm`}
                    onChange={(value) => patch({ marginMm: value })}
                  />
                  <Slider
                    label="尺寸"
                    value={settings.scale}
                    min={0.9}
                    max={1.05}
                    step={0.01}
                    format={() => scaleText}
                    onChange={(value) => patch({ scale: value })}
                  />
                </section>

                <section className="print-block">
                  <h3 className="print-block-title">打印辅助</h3>
                  <div className="print-switches">
                    <SwitchRow
                      label="裁切线"
                      checked={settings.guides}
                      onChange={(value) => patch({ guides: value })}
                    />
                    <SwitchRow
                      label="卡片细边"
                      checked={settings.border}
                      onChange={(value) => patch({ border: value })}
                    />
                    <SwitchRow
                      label="校准尺 50 mm"
                      checked={settings.ruler}
                      onChange={(value) => patch({ ruler: value })}
                    />
                    <SwitchRow
                      label="带水印"
                      checked={settings.watermark}
                      onChange={(value) => patch({ watermark: value })}
                    />
                  </div>
                </section>
              </div>

              <div className="print-foot">
                {layout.warnings.map((warning) => (
                  <p
                    key={warning.level}
                    className={
                      warning.level === 'error' ? 'print-warn is-error' : 'print-warn is-notice'
                    }
                  >
                    {warning.text}
                  </p>
                ))}
                <button
                  type="button"
                  className="button button-primary button-block"
                  onClick={() => void handlePrint()}
                >
                  <IconPrint size={14} />
                  打印 / 存为 PDF
                </button>
                <p className="print-note">
                  打印时把「缩放」设为 <b>100%（实际大小）</b>，关闭页眉页脚；尺子量到的左边距应与上方数值一致。
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <div className="print-sheet-portal" aria-hidden="true">
        <canvas ref={printRef} className="print-sheet-page" />
      </div>
    </>,
    document.body,
  );
}

export function PrintSheet() {
  const open = usePrint((state) => state.open);
  const closeSheet = usePrint((state) => state.closeSheet);
  if (!open) return null;
  return <PrintSheetDialog onClose={closeSheet} />;
}
