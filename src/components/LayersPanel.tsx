import { useRef } from 'react';
import { MAX_LAYERS } from '../core/defaults';
import { useEditor } from '../state/editorStore';
import type { WatermarkLayer } from '../core/types';
import {
  IconCopy,
  IconEye,
  IconEyeOff,
  IconImage,
  IconRedact,
  IconText,
  IconTrash,
} from './icons';

const layoutLabel = (layer: WatermarkLayer): string => {
  if (layer.type === 'redact') return `${layer.regions.length} 个区域`;
  if (layer.layout.mode === 'tile') return '平铺';
  if (layer.layout.mode === 'grid') return `${layer.layout.cols}×${layer.layout.rows} 网格`;
  return '单点';
};

const LayerIcon = ({ layer }: { layer: WatermarkLayer }) => {
  if (layer.type === 'text') return <IconText size={13} />;
  if (layer.type === 'image') return <IconImage size={13} />;
  return <IconRedact size={13} />;
};

export function LayersPanel() {
  const layers = useEditor((state) => state.layers);
  const selectedId = useEditor((state) => state.selectedId);
  const selectLayer = useEditor((state) => state.selectLayer);
  const updateLayer = useEditor((state) => state.updateLayer);
  const removeLayer = useEditor((state) => state.removeLayer);
  const duplicateLayer = useEditor((state) => state.duplicateLayer);
  const addTextLayer = useEditor((state) => state.addTextLayer);
  const addImageLayer = useEditor((state) => state.addImageLayer);
  const addRedactLayer = useEditor((state) => state.addRedactLayer);
  const logoInput = useRef<HTMLInputElement | null>(null);

  return (
    <aside className="rail">
      <div className="panel-head">
        <span className="panel-title">图层</span>
        <div className="spacer" />
        <span className="panel-count">
          {layers.length}/{MAX_LAYERS}
        </span>
      </div>

      <div className="panel-scroll">
        <div className="layer-list">
          {layers.length === 0 ? (
            <div className="empty-note">
              还没有水印图层。
              <br />
              添加一个文字或 Logo 图层开始。
            </div>
          ) : null}
          {layers.map((layer) => (
            <div
              key={layer.id}
              role="button"
              tabIndex={0}
              className={`layer-item${layer.id === selectedId ? ' is-active' : ''}${
                layer.visible ? '' : ' is-hidden'
              }`}
              onClick={() => selectLayer(layer.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  selectLayer(layer.id);
                }
              }}
            >
              <span className="layer-kind">
                <LayerIcon layer={layer} />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="layer-name" style={{ display: 'block' }}>
                  {layer.name}
                </span>
                <span className="layer-sub">
                  {layoutLabel(layer)} · {Math.round(layer.opacity * 100)}%
                </span>
              </span>
              <span className="layer-actions">
                <button
                  type="button"
                  className="icon-mini"
                  title={layer.visible ? '隐藏图层' : '显示图层'}
                  onClick={(event) => {
                    event.stopPropagation();
                    updateLayer(layer.id, { visible: !layer.visible });
                  }}
                >
                  {layer.visible ? <IconEye size={13} /> : <IconEyeOff size={13} />}
                </button>
                <button
                  type="button"
                  className="icon-mini"
                  title="复制图层"
                  onClick={(event) => {
                    event.stopPropagation();
                    duplicateLayer(layer.id);
                  }}
                >
                  <IconCopy size={13} />
                </button>
                <button
                  type="button"
                  className="icon-mini"
                  title="删除图层"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeLayer(layer.id);
                  }}
                >
                  <IconTrash size={13} />
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rail-footer">
        <div className="rail-add">
          <button
            type="button"
            className="rail-add-button"
            aria-label="添加文字水印"
            title="添加文字水印"
            onClick={addTextLayer}
            disabled={layers.length >= MAX_LAYERS}
          >
            <IconText size={15} />
            <span>文字</span>
          </button>
          <button
            type="button"
            className="rail-add-button"
            aria-label="添加 Logo 水印"
            title="添加 Logo 水印"
            onClick={() => logoInput.current?.click()}
            disabled={layers.length >= MAX_LAYERS}
          >
            <IconImage size={15} />
            <span>Logo</span>
          </button>
          <button
            type="button"
            className="rail-add-button"
            aria-label="添加打码"
            title="添加打码图层"
            onClick={addRedactLayer}
            disabled={layers.length >= MAX_LAYERS}
          >
            <IconRedact size={15} />
            <span>打码</span>
          </button>
        </div>
        <input
          ref={logoInput}
          type="file"
          accept="image/png,image/svg+xml,image/webp,image/jpeg"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void addImageLayer(file);
          }}
        />
      </div>
    </aside>
  );
}
