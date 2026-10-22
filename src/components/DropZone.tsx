import { useRef, useState } from 'react';
import { useEditor } from '../state/editorStore';
import { IconLock, IconUpload } from './icons';

export function DropZone() {
  const addImages = useEditor((state) => state.addImages);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    void addImages(Array.from(files));
  };

  return (
    <div
      className={over ? 'dropzone is-over' : 'dropzone'}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOver(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <div className="dropzone-icon">
        <IconUpload size={22} />
      </div>
      <h2>把图片拖进来，或点击选择</h2>
      <p>
        全部处理都在浏览器本地完成，图片不会上传到任何服务器。支持 JPG / PNG / WebP / GIF / BMP /
        AVIF，最多 60 张。
      </p>
      <button type="button" className="button button-primary" onClick={() => inputRef.current?.click()}>
        <IconUpload size={14} />
        选择图片
      </button>
      <div className="dropzone-shortcuts">
        <span>
          <b>Ctrl / ⌘ + V</b> 粘贴截图
        </span>
        <span>
          <b>空格</b> 对比原图
        </span>
        <span>
          <b>Ctrl / ⌘ + Z</b> 撤销
        </span>
      </div>
      <div className="dropzone-shortcuts" style={{ marginTop: 4 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <IconLock size={12} /> 零上传 · 可离线使用
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
}
