import { runBatch } from '../features/batchExport';
import { useEditor } from '../state/editorStore';
import { formatBytes } from '../core/imageSource';
import { IconDownload, IconMoon, IconRedo, IconSun, IconUndo } from './icons';

export function TopBar() {
  const images = useEditor((state) => state.images);
  const layers = useEditor((state) => state.layers);
  const theme = useEditor((state) => state.theme);
  const setTheme = useEditor((state) => state.setTheme);
  const undo = useEditor((state) => state.undo);
  const redo = useEditor((state) => state.redo);
  const pastCount = useEditor((state) => state.pastCount);
  const futureCount = useEditor((state) => state.futureCount);
  const format = useEditor((state) => state.exportSettings.format);

  const totalBytes = images.reduce((sum, item) => sum + item.size, 0);
  const pending = images.filter((item) => !item.skipped).length;

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">水</div>
        <div className="brand-text">
          <span className="brand-name">Watermark Studio</span>
          <span className="brand-sub">本地批量水印工坊</span>
        </div>
      </div>

      <div className="topbar-meta">
        <span className="meta-chip">
          图片 <strong>{images.length}</strong>
        </span>
        <span className="meta-chip">
          待处理 <strong>{pending}</strong>
        </span>
        <span className="meta-chip">
          图层 <strong>{layers.length}</strong>
        </span>
        {images.length ? (
          <span className="meta-chip">共 {formatBytes(totalBytes)}</span>
        ) : null}
        <span className="meta-chip">输出 {format === 'original' ? '原格式' : format.toUpperCase()}</span>
      </div>

      <div className="spacer" />

      <div className="topbar-actions">
        <button
          type="button"
          className="icon-button"
          title="撤销 (Ctrl/⌘ + Z)"
          disabled={pastCount === 0}
          onClick={undo}
        >
          <IconUndo size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          title="重做 (Ctrl/⌘ + Shift + Z)"
          disabled={futureCount === 0}
          onClick={redo}
        >
          <IconRedo size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          title={theme === 'dark' ? '切换到浅色' : '切换到深色'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
        </button>
        <button
          type="button"
          className="button button-primary"
          disabled={!pending}
          onClick={() => void runBatch('zip')}
        >
          <IconDownload size={14} />
          导出全部
        </button>
      </div>
    </header>
  );
}
