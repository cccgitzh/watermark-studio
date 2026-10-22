import { formatDuration } from '../core/export';
import { useBatchStore } from '../state/batchStore';

export function ProgressOverlay() {
  const progress = useBatchStore((state) => state.progress);
  const cancelRequested = useBatchStore((state) => state.cancelRequested);
  const requestCancel = useBatchStore((state) => state.requestCancel);

  if (!progress) return null;

  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const elapsed = Date.now() - progress.startedAt;
  const remaining =
    progress.done > 0 ? (elapsed / progress.done) * (progress.total - progress.done) : Number.NaN;

  return (
    <div className="progress-overlay" role="status" aria-live="polite">
      <div className="progress-card">
        <p className="progress-title">
          {progress.phase === 'zip' ? '正在打包 ZIP' : progress.label}
        </p>
        <p className="progress-sub">
          {progress.done} / {progress.total} 张 · 已用时 {formatDuration(elapsed)}
          {progress.done > 0 && progress.phase === 'render'
            ? ` · 预计剩余 ${formatDuration(remaining)}`
            : ''}
          {progress.failed > 0 ? ` · 失败 ${progress.failed}` : ''}
        </p>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${progress.phase === 'zip' ? Math.max(percent, 96) : percent}%` }}
          />
        </div>
        <div className="progress-actions">
          <button
            type="button"
            className="button button-sm button-ghost"
            onClick={requestCancel}
            disabled={cancelRequested}
          >
            {cancelRequested ? '正在取消…' : '取消'}
          </button>
        </div>
      </div>
    </div>
  );
}
