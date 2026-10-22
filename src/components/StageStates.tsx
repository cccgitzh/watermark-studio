import { formatBytes } from '../core/imageSource';
import type { ImageItem } from '../core/types';
import { IconArrowRight, IconClose, IconRotate } from './icons';

/**
 * 台面的两种非就绪态。
 * 结构上与 `.print` 对齐：同样的一张「纸」，只是纸上还没有画面 ——
 * 让加载与错误出现在数据将出现的位置，而不是浮层或空白。
 */

export function StageReading({
  done,
  total,
  onCancel,
}: {
  done: number;
  total: number;
  onCancel: () => void;
}) {
  const percent = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="stage-state" role="status" aria-live="polite">
      <div className="print print-blank">
        <div className="print-skeleton" aria-hidden="true" />
      </div>
      <div className="stage-state-caption">
        <span className="stage-state-title">
          正在读取 <span className="num">{done}</span> / <span className="num">{total}</span> 张
        </span>
        <div
          className="stage-state-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        <button type="button" className="button button-sm" onClick={onCancel}>
          取消读取
        </button>
      </div>
    </div>
  );
}

export function StageError({
  item,
  onRetry,
  onRemove,
  onFiles,
}: {
  item: ImageItem;
  onRetry: () => void;
  onRemove: () => void;
  onFiles: (files: File[]) => void;
}) {
  return (
    <div className="stage-state" role="alert">
      <div className="print print-broken">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="print-broken-mark">
          <rect x="3" y="4.5" width="18" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M3.8 17.2 9 11.8l3.4 3.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity=".5" />
          <path d="m5.2 6.4 13.6 12.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
      <div className="stage-state-caption stage-state-caption-wide">
        <span className="stage-state-title">这张图读不出来</span>
        <p className="stage-state-body">
          <span className="stage-state-file">{item.name}</span>
          <span className="dot" aria-hidden="true" />
          <span className="num">{formatBytes(item.size)}</span>
        </p>
        <p className="stage-state-reason">{item.error ?? '浏览器无法解码这个文件'}</p>
        <div className="stage-state-actions">
          <button type="button" className="button button-sm button-primary" onClick={onRetry}>
            <IconRotate size={13} />
            重试这张
          </button>
          <button type="button" className="button button-sm" onClick={onRemove}>
            <IconClose size={13} />
            从队列移除
          </button>
          <label className="button button-sm button-ghost">
            换一张
            <IconArrowRight size={13} />
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = '';
                if (files.length) onFiles(files);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
