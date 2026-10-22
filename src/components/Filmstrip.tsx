import { useEffect, useRef } from 'react';
import { useEditor, type ImageItem } from '../state/editorStore';
import { IconArrowLeft, IconArrowRight, IconPlus, IconTrash } from './icons';

function Thumb({ item }: { item: ImageItem }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // 等比裁剪填满缩略图
    const scale = Math.max(canvas.width / item.width, canvas.height / item.height);
    const drawW = item.width * scale;
    const drawH = item.height * scale;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(item.bitmap, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH);
  }, [item.bitmap, item.width, item.height]);

  return <canvas ref={ref} width={148} height={120} />;
}

export function Filmstrip() {
  const images = useEditor((state) => state.images);
  const activeImageId = useEditor((state) => state.activeImageId);
  const setActiveImage = useEditor((state) => state.setActiveImage);
  const moveImage = useEditor((state) => state.moveImage);
  const removeImage = useEditor((state) => state.removeImage);
  const toggleSkip = useEditor((state) => state.toggleSkip);
  const clearImages = useEditor((state) => state.clearImages);
  const addImages = useEditor((state) => state.addImages);
  const importsBusy = useEditor((state) => state.importsBusy);
  const activeIndex = images.findIndex((item) => item.id === activeImageId);

  return (
    <div className="filmstrip">
      <div className="filmstrip-head">
        <span>图片顺序{importsBusy ? ' · 正在读取' : ''}</span>
        <div className="spacer" />
        <button
          type="button"
          className="icon-mini"
          title="前移"
          disabled={activeIndex <= 0}
          onClick={() => moveImage(activeImageId ?? '', -1)}
        >
          <IconArrowLeft size={13} />
        </button>
        <button
          type="button"
          className="icon-mini"
          title="后移"
          disabled={activeIndex < 0 || activeIndex >= images.length - 1}
          onClick={() => moveImage(activeImageId ?? '', 1)}
        >
          <IconArrowRight size={13} />
        </button>
        <button
          type="button"
          className="icon-mini"
          title="移除当前图片"
          disabled={activeIndex < 0}
          onClick={() => activeImageId && removeImage(activeImageId)}
        >
          <IconTrash size={13} />
        </button>
        <button type="button" className="button button-sm button-ghost" onClick={clearImages}>
          清空
        </button>
      </div>
      <div className="filmstrip-track">
        {images.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`thumb${item.id === activeImageId ? ' is-active' : ''}${
              item.skipped ? ' is-skipped' : ''
            }`}
            onClick={() => setActiveImage(item.id)}
            title={`${item.name} · ${item.width}×${item.height}`}
          >
            <Thumb item={item} />
            <span className="thumb-badge">{index + 1}</span>
            <span
              className="thumb-skip"
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                toggleSkip(item.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.stopPropagation();
                  toggleSkip(item.id);
                }
              }}
            >
              {item.skipped ? '恢复处理' : '跳过'}
            </span>
          </button>
        ))}
        <label className="thumb thumb-add" title="添加更多图片">
          <IconPlus size={18} />
          <span>添加</span>
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = '';
              if (files.length) void addImages(files);
            }}
          />
        </label>
      </div>
    </div>
  );
}
