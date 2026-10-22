import { runBatch } from '../features/batchExport';
import { countPending } from '../core/queue';
import { useEditor } from '../state/editorStore';
import { IconDownload, IconMoon, IconRedo, IconSun, IconUndo } from './icons';

/** 顶栏：产品标识 + 作用域，右侧是撤销栈、主题与这一屏唯一的主操作。 */
export function TopBar() {
  const theme = useEditor((state) => state.theme);
  const setTheme = useEditor((state) => state.setTheme);
  const undo = useEditor((state) => state.undo);
  const redo = useEditor((state) => state.redo);
  const pastCount = useEditor((state) => state.pastCount);
  const futureCount = useEditor((state) => state.futureCount);
  const pending = useEditor((state) => countPending(state.images));

  return (
    <header className="topbar">
      <div className="brand">
        <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
          <rect
            x="3.25"
            y="4.75"
            width="17.5"
            height="14.5"
            rx="2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M4.5 15.5 9 11l3.4 3.2L15 12l4.5 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 8.6l12 5.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity=".55"
          />
        </svg>
        <span className="brand-name">Watermark Studio</span>
        <span className="brand-scope">本地处理 · 零上传</span>
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
        <span className="topbar-divider" aria-hidden="true" />
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
