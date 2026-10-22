import { useRef } from 'react';
import { resolveMime, extFromMime } from '../core/export';
import { useEditor } from '../state/editorStore';
import { IconCompare, IconPlus } from './icons';

/**
 * 纸张抬头：这一屏的问题「这批图能不能直接导出」由标题下的那句话回答，
 * 右侧只放画布级的两个操作，主操作留在顶栏。
 */
export function SheetHead() {
  const images = useEditor((state) => state.images);
  const activeImage = useEditor(
    (state) => state.images.find((item) => item.id === state.activeImageId) ?? null,
  );
  const format = useEditor((state) => state.exportSettings.format);
  const comparing = useEditor((state) => state.comparing);
  const setComparing = useEditor((state) => state.setComparing);
  const addImages = useEditor((state) => state.addImages);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pending = images.filter((item) => !item.skipped).length;
  const ext = extFromMime(
    resolveMime(format, activeImage?.mime ?? 'image/jpeg'),
  ).toUpperCase();

  const summary =
    images.length === 0
      ? '拖入图片开始，全部处理都在本机完成'
      : `队列 ${images.length} 张，${pending} 张待处理，导出为 ${ext}`;

  return (
    <header className="sheet-head">
      <div className="sheet-head-text">
        <h1 className="sheet-title">批量水印</h1>
        <p className="sheet-sub">{summary}</p>
      </div>
      <div className="sheet-actions">
        <button type="button" className="button" onClick={() => inputRef.current?.click()}>
          <IconPlus size={14} />
          添加图片
        </button>
        <button
          type="button"
          className={comparing ? 'button is-pressed' : 'button'}
          onClick={() => setComparing(!comparing)}
          title="按住空格也可临时对比"
          disabled={!activeImage}
        >
          <IconCompare size={14} />
          {comparing ? '原图' : '对比原图'}
        </button>
        <input
          ref={inputRef}
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
      </div>
    </header>
  );
}
