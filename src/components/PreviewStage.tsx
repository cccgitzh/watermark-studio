import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { formatBytes } from '../core/imageSource';
import { isLayoutLayer, isRedactLayer } from '../core/layers';
import { renderComposite } from '../core/renderer';
import type { RedactRegion } from '../core/types';
import { useLogoImages } from '../hooks/useLogoImages';
import { useEditor } from '../state/editorStore';
import { DropZone } from './DropZone';
import { Filmstrip } from './Filmstrip';
import { IconCompare, IconRedact } from './icons';

type RegionDrag =
  | { kind: 'move' | 'resize'; id: string; startX: number; startY: number; origin: RedactRegion }
  | { kind: 'create'; startX: number; startY: number };

const MIN_REGION = 0.012;
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function PreviewStage() {
  const images = useEditor((state) => state.images);
  const activeImage = useEditor(
    (state) => state.images.find((item) => item.id === state.activeImageId) ?? null,
  );
  const layers = useEditor((state) => state.layers);
  const comparing = useEditor((state) => state.comparing);
  const setComparing = useEditor((state) => state.setComparing);
  const selectedId = useEditor((state) => state.selectedId);
  const updateLayout = useEditor((state) => state.updateLayout);
  const addRedactRegion = useEditor((state) => state.addRedactRegion);
  const updateRedactRegion = useEditor((state) => state.updateRedactRegion);
  const removeRedactRegion = useEditor((state) => state.removeRedactRegion);
  const logos = useLogoImages(layers);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [display, setDisplay] = useState({ width: 0, height: 0 });
  const [stageDragging, setStageDragging] = useState(false);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RedactRegion | null>(null);
  const [regionDrag, setRegionDrag] = useState<RegionDrag | null>(null);
  const stageDrag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null>(null);

  const selectedLayer = layers.find((layer) => layer.id === selectedId) ?? null;
  const redactLayer =
    selectedLayer && isRedactLayer(selectedLayer) && selectedLayer.visible ? selectedLayer : null;
  const canDragStage =
    Boolean(selectedLayer && isLayoutLayer(selectedLayer) && selectedLayer.layout.mode === 'single') &&
    !comparing;
  const canDrawRegion = Boolean(redactLayer) && !comparing;

  // 预览固定变量：当前图片名 + 第 1 张
  const previewVars = useMemo(
    () => ({ fileName: activeImage?.name ?? '', index: 0, total: 1 }),
    [activeImage?.name],
  );

  // 自适应容器尺寸
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !activeImage) return;

    const measure = () => {
      const availableW = wrap.clientWidth;
      const availableH = wrap.clientHeight;
      if (!availableW || !availableH) return;
      const ratio = Math.min(availableW / activeImage.width, availableH / activeImage.height);
      setDisplay({
        width: Math.max(1, Math.round(activeImage.width * ratio)),
        height: Math.max(1, Math.round(activeImage.height * ratio)),
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [activeImage]);

  // 绘制预览（限制在动画帧内，滑杆连续拖动不会堆积重绘）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeImage || !display.width) return;

    const frame = requestAnimationFrame(() => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const backingW = Math.round(display.width * dpr);
      const backingH = Math.round(display.height * dpr);
      if (canvas.width !== backingW) canvas.width = backingW;
      if (canvas.height !== backingH) canvas.height = backingH;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (comparing) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, backingW, backingH);
        ctx.drawImage(activeImage.bitmap, 0, 0, backingW, backingH);
        return;
      }

      renderComposite(ctx, activeImage.bitmap, {
        width: backingW,
        height: backingH,
        layers,
        logos,
        vars: previewVars,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [activeImage, display, layers, logos, comparing, previewVars]);

  // 选中打码图层时默认选中第一个区域
  useEffect(() => {
    if (!redactLayer) {
      setActiveRegionId(null);
      return;
    }
    setActiveRegionId((current) => {
      if (current && redactLayer.regions.some((item) => item.id === current)) return current;
      return redactLayer.regions[0]?.id ?? null;
    });
  }, [redactLayer]);

  const toNormalized = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clamp01((clientX - rect.left) / Math.max(1, rect.width)),
      y: clamp01((clientY - rect.top) / Math.max(1, rect.height)),
    };
  };

  // 打码区域：移动 / 缩放 / 框选草稿
  useEffect(() => {
    if (!regionDrag) return;

    const onMove = (event: PointerEvent) => {
      const point = toNormalized(event.clientX, event.clientY);
      const drag = regionDrag;

      if (drag.kind === 'create') {
        setDraft({
          id: 'draft',
          x: Math.min(drag.startX, point.x),
          y: Math.min(drag.startY, point.y),
          w: Math.abs(point.x - drag.startX),
          h: Math.abs(point.y - drag.startY),
        });
        return;
      }
      if (!redactLayer) return;
      const origin = drag.origin;
      if (drag.kind === 'move') {
        updateRedactRegion(
          redactLayer.id,
          drag.id,
          {
            x: Math.min(Math.max(0, origin.x + (point.x - drag.startX)), 1 - origin.w),
            y: Math.min(Math.max(0, origin.y + (point.y - drag.startY)), 1 - origin.h),
          },
          `region-${drag.id}`,
        );
        return;
      }
      updateRedactRegion(
        redactLayer.id,
        drag.id,
        {
          w: Math.min(Math.max(MIN_REGION, origin.w + (point.x - drag.startX)), 1 - origin.x),
          h: Math.min(Math.max(MIN_REGION, origin.h + (point.y - drag.startY)), 1 - origin.y),
        },
        `region-${drag.id}`,
      );
    };

    const onUp = () => {
      if (regionDrag.kind === 'create' && redactLayer) {
        // 只有真正拖出面积才落成区域，避免单击误建
        setDraft((current) => {
          if (current && current.w >= MIN_REGION && current.h >= MIN_REGION) {
            const region: RedactRegion = {
              id: `rg_${Math.random().toString(36).slice(2, 9)}`,
              x: current.x,
              y: current.y,
              w: current.w,
              h: current.h,
            };
            addRedactRegion(redactLayer.id, region);
            setActiveRegionId(region.id);
          }
          return null;
        });
      }
      setRegionDrag(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [regionDrag, redactLayer, updateRedactRegion, addRedactRegion]);

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (comparing || event.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (redactLayer) {
      const point = toNormalized(event.clientX, event.clientY);
      setRegionDrag({ kind: 'create', startX: point.x, startY: point.y });
      setActiveRegionId(null);
      return;
    }

    if (!canDragStage || !selectedLayer || !isLayoutLayer(selectedLayer)) return;
    if (selectedLayer.layout.mode !== 'single') return;
    canvas.setPointerCapture(event.pointerId);
    stageDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: selectedLayer.layout.offsetX,
      offsetY: selectedLayer.layout.offsetY,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    };
    setStageDragging(true);
  };

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = stageDrag.current;
    if (!drag || drag.pointerId !== event.pointerId || !selectedLayer) return;
    if (!isLayoutLayer(selectedLayer)) return;
    const dx = (event.clientX - drag.startX) / Math.max(1, drag.width);
    const dy = (event.clientY - drag.startY) / Math.max(1, drag.height);
    updateLayout(
      selectedLayer.id,
      {
        offsetX: Math.max(-1, Math.min(1, drag.offsetX + dx)),
        offsetY: Math.max(-1, Math.min(1, drag.offsetY + dy)),
      },
      `drag-${selectedLayer.id}`,
    );
  };

  const handleCanvasPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = stageDrag.current;
    if (drag && canvasRef.current?.hasPointerCapture(drag.pointerId)) {
      canvasRef.current.releasePointerCapture(drag.pointerId);
    }
    stageDrag.current = null;
    setStageDragging(false);
    void event;
  };

  const startRegionDrag = (
    event: ReactPointerEvent<HTMLElement>,
    kind: 'move' | 'resize',
    region: RedactRegion,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const point = toNormalized(event.clientX, event.clientY);
    setActiveRegionId(region.id);
    setRegionDrag({ kind, id: region.id, startX: point.x, startY: point.y, origin: region });
  };

  const canvasClass = [
    'preview-canvas',
    canDragStage && !redactLayer ? 'is-draggable' : '',
    canDrawRegion ? 'is-redact' : '',
    stageDragging ? 'is-dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const overlayRegions = redactLayer ? redactLayer.regions : [];
  const showDraft = Boolean(draft);
  const hintText = redactLayer
    ? '拖动框选打码区域 · 拖动方框移动 · 右下角缩放'
    : '拖动可直接调整水印位置 · 方向键微调';

  return (
    <section className="stage">
      <div className="stage-bar">
        {activeImage ? (
          <>
            <div className="stage-file">
              <span>{activeImage.name}</span>
            </div>
            <span className="stage-dim">
              {activeImage.width} × {activeImage.height}
            </span>
            <span className="stage-dim">{formatBytes(activeImage.size)}</span>
            <span className="stage-dim">{activeImage.mime.replace('image/', '').toUpperCase()}</span>
            <div className="spacer" />
            <label className="button button-sm button-ghost" style={{ cursor: 'pointer' }}>
              添加图片
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = '';
                  if (files.length) void useEditor.getState().addImages(files);
                }}
              />
            </label>
            <button
              type="button"
              className={comparing ? 'button button-sm' : 'button button-sm button-ghost'}
              onClick={() => setComparing(!comparing)}
              title="按住空格也可临时对比"
            >
              <IconCompare size={14} />
              {comparing ? '返回水印' : '对比原图'}
            </button>
          </>
        ) : (
          <span style={{ color: 'var(--muted)' }}>尚未载入图片</span>
        )}
      </div>

      <div className="stage-canvas-wrap" ref={wrapRef}>
        {activeImage ? (
          <div className="canvas-shell">
            <canvas
              ref={canvasRef}
              className={canvasClass}
              style={{ width: display.width, height: display.height }}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerCancel={handleCanvasPointerUp}
            />

            {redactLayer ? (
              <div className="redact-overlay">
                {overlayRegions.map((region, index) => (
                  <div
                    key={region.id}
                    className={
                      region.id === activeRegionId ? 'redact-region is-active' : 'redact-region'
                    }
                    style={{
                      left: `${region.x * 100}%`,
                      top: `${region.y * 100}%`,
                      width: `${region.w * 100}%`,
                      height: `${region.h * 100}%`,
                    }}
                    onPointerDown={(event) => startRegionDrag(event, 'move', region)}
                    role="presentation"
                  >
                    <span className="redact-region-tag">{index + 1}</span>
                    {region.id === activeRegionId ? (
                      <>
                        <button
                          type="button"
                          className="redact-remove"
                          title="删除该区域"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => {
                            removeRedactRegion(redactLayer.id, region.id);
                            setActiveRegionId(null);
                          }}
                        >
                          ×
                        </button>
                        <span
                          className="redact-handle"
                          role="presentation"
                          onPointerDown={(event) => startRegionDrag(event, 'resize', region)}
                        />
                      </>
                    ) : null}
                  </div>
                ))}
                {draft ? (
                  <div
                    className="redact-region is-draft"
                    style={{
                      left: `${draft.x * 100}%`,
                      top: `${draft.y * 100}%`,
                      width: `${draft.w * 100}%`,
                      height: `${draft.h * 100}%`,
                    }}
                  />
                ) : null}
              </div>
            ) : null}

            {comparing ? <div className="compare-tag">原图预览</div> : null}
            {(canDrawRegion || canDragStage) && !regionDrag && !stageDragging && !showDraft ? (
              <div className="drag-badge">
                {redactLayer ? <IconRedact size={12} /> : null}
                {hintText}
              </div>
            ) : null}
          </div>
        ) : (
          <DropZone />
        )}
      </div>

      {images.length > 0 ? (
        <Filmstrip />
      ) : (
        <div className="filmstrip">
          <div className="filmstrip-head">
            <span>图片队列为空 · 支持拖拽、粘贴或点击上传（最多 60 张）</span>
          </div>
        </div>
      )}
    </section>
  );
}
