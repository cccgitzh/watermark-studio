import { useEffect, useState } from 'react';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useEditor } from './state/editorStore';
import { Inspector } from './components/Inspector';
import { LayersPanel } from './components/LayersPanel';
import { PreviewStage } from './components/PreviewStage';
import { ProgressOverlay } from './components/ProgressOverlay';
import { SheetHead } from './components/SheetHead';
import { ToastHost } from './components/ToastHost';
import { TopBar } from './components/TopBar';
import { IconUpload } from './components/icons';

export default function App() {
  const theme = useEditor((state) => state.theme);
  const addImages = useEditor((state) => state.addImages);
  const [dropping, setDropping] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useKeyboardShortcuts();

  // 全窗口拖拽上传（DropZone 内部会阻断冒泡，不会重复添加）
  useEffect(() => {
    let counter = 0;
    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files');

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      counter += 1;
      setDropping(true);
    };
    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      counter = Math.max(0, counter - 1);
      if (counter === 0) setDropping(false);
    };
    const onDragOver = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      counter = 0;
      setDropping(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length) void addImages(files);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [addImages]);

  return (
    <div className="app">
      <TopBar />
      <div className="frame">
        <LayersPanel />
        <main className="sheet">
          <SheetHead />
          <div className="sheet-body">
            <PreviewStage />
            <Inspector />
          </div>
        </main>
      </div>
      {dropping ? (
        <div className="drop-overlay">
          <div className="drop-overlay-card">
            <IconUpload size={22} />
            <strong>松手即可加入队列</strong>
            <span>图片只在本机浏览器内处理</span>
          </div>
        </div>
      ) : null}
      <ToastHost />
      <ProgressOverlay />
    </div>
  );
}
