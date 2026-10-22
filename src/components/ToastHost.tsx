import { useEffect } from 'react';
import { useEditor } from '../state/editorStore';
import { IconCheck, IconClose } from './icons';

export function ToastHost() {
  const toast = useEditor((state) => state.toast);
  const clearToast = useEditor((state) => state.clearToast);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(clearToast, 2600);
    return () => window.clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) return null;

  return (
    <div className="toast-stack" aria-live="polite">
      <div className={`toast${toast.kind === 'success' ? ' is-success' : ''}${toast.kind === 'error' ? ' is-error' : ''}`}>
        {toast.kind === 'error' ? <IconClose size={13} /> : <IconCheck size={13} />}
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
