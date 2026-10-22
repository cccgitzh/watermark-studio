import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { formatBytes } from '../core/imageSource';
import { renderComposite } from '../core/renderer';
import { useLogoImages } from '../hooks/useLogoImages';
import { useEditor } from '../state/editorStore';
import { DropZone } from './DropZone';
import { Filmstrip } from './Filmstrip';
import { IconCompare } from './icons';

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
  const logos = useLogoImages(layers);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [display, setDisplay] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null>(null);

  const selectedLayer = layers.find((layer) => layer.id === selectedId) ?? null;
  const canDrag = Boolean(selectedLayer && selectedLayer.layout.mode === 'single') && !comparing;

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
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [activeImage, display, layers, logos, comparing]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canDrag || !selectedLayer || selectedLayer.layout.mode !== 'single') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: selectedLayer.layout.offsetX,
      offsetY: selectedLayer.layout.offsetY,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    };
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !selectedLayer) return;
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

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag && canvasRef.current?.hasPointerCapture(drag.pointerId)) {
      canvasRef.current.releasePointerCapture(drag.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
    void event;
  };

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
              className={`preview-canvas${canDrag ? ' is-draggable' : ''}${
                dragging ? ' is-dragging' : ''
              }`}
              style={{ width: display.width, height: display.height }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
            {comparing ? <div className="compare-tag">原图预览</div> : null}
            {canDrag && !dragging ? (
              <div className="drag-badge">拖动可直接调整水印位置</div>
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
