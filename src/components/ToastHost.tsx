import { useEffect } from 'react';
import { useEditor } from '../state/editorStore';
import { IconCheck, IconClose } from './icons';

/** 错误要留得住：成功提示 2.4s 自动消失，错误停 6s 且可手动关闭。 */
const AUTO_DISMISS: Record<string, number> = { success: 2400, info: 3000, error: 6000 };

export function ToastHost() {
  const toast = useEditor((state) => state.toast);
  const clearToast = useEditor((state) => state.clearToast);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(clearToast, AUTO_DISMISS[toast.kind] ?? 3000);
    return () => window.clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) return null;

  const isError = toast.kind === 'error';

  return (
    <div className="toast-stack" aria-live={isError ? 'assertive' : 'polite'}>
      <div className={`toast is-${toast.kind}`} role={isError ? 'alert' : 'status'}>
        {isError ? <IconClose size={13} /> : <IconCheck size={13} />}
        <span className="toast-text">{toast.message}</span>
        <button type="button" className="toast-close" title="关闭提示" onClick={clearToast}>
          <IconClose size={12} />
        </button>
      </div>
    </div>
  );
}
