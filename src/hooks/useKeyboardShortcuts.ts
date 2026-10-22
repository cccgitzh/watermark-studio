import { useEffect } from 'react';
import { useEditor } from '../state/editorStore';

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
};

/** 全局快捷键：撤销 / 重做 / 按住空格对比原图 / 粘贴上传 */
export function useKeyboardShortcuts() {
  const undo = useEditor((state) => state.undo);
  const redo = useEditor((state) => state.redo);
  const setComparing = useEditor((state) => state.setComparing);
  const addImages = useEditor((state) => state.addImages);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const withMeta = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (withMeta && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (withMeta && key === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (event.code === 'Space' && !isTypingTarget(event.target)) {
        event.preventDefault();
        setComparing(true);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setComparing(false);
    };

    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
        file.type.startsWith('image/'),
      );
      if (!files.length) return;
      event.preventDefault();
      void addImages(files);
    };

    const onBlur = () => setComparing(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('paste', onPaste);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('blur', onBlur);
    };
  }, [undo, redo, setComparing, addImages]);
}
