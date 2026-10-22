import { useEffect } from 'react';
import { isLayoutLayer } from '../core/layers';
import { useEditor } from '../state/editorStore';

const ARROW_DELTA: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/**
 * 焦点在可交互元素上时，方向键 / 空格属于该控件自己
 * （页签切换、单选组移动、按钮激活、滑杆步进），全局快捷键必须让路。
 */
const isInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], button, a[href], summary, [role="radio"], [role="tab"], [role="switch"], [role="button"]',
    ),
  );
};

/** 只有真的用方向键移动的控件才占用方向键；普通按钮不占用，微调仍可用 */
const isArrowOwner = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], summary, [role="radio"], [role="tab"]'),
  );
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
      if (event.code === 'Space' && !isInteractiveTarget(event.target)) {
        event.preventDefault();
        setComparing(true);
        return;
      }

      // 方向键微调单点水印位置（Shift 更精细）
      const delta = ARROW_DELTA[event.key];
      if (delta && !withMeta && !isArrowOwner(event.target)) {
        const state = useEditor.getState();
        const layer = state.layers.find((item) => item.id === state.selectedId);
        if (!layer || !isLayoutLayer(layer) || layer.layout.mode !== 'single') return;
        event.preventDefault();
        const step = event.shiftKey ? 0.001 : 0.01;
        state.updateLayout(
          layer.id,
          {
            offsetX: Math.min(1, Math.max(-1, layer.layout.offsetX + delta[0] * step)),
            offsetY: Math.min(1, Math.max(-1, layer.layout.offsetY + delta[1] * step)),
          },
          `nudge-${layer.id}`,
        );
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
