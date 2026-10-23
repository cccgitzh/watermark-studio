import { gridLayout, singleLayout, tileLayout } from '../core/defaults';
import { useEditor } from '../state/editorStore';
import type { Anchor9, WatermarkLayer } from '../core/types';
import { AnchorGrid, Field, Hint, PanelSection, Segmented, Slider, SwitchRow } from './controls';
import { deg, pct } from './format';

export function LayoutPanel({ layer }: { layer: WatermarkLayer | null }) {
  const updateLayer = useEditor((state) => state.updateLayer);
  const updateLayout = useEditor((state) => state.updateLayout);
  const layers = useEditor((state) => state.layers);
  const moveLayer = useEditor((state) => state.moveLayer);

  if (!layer) {
    return (
      <div className="empty-note" style={{ padding: '40px 16px' }}>
        选择一个图层后可调整它的排布方式。
      </div>
    );
  }

  if (layer.type === 'redact') {
    return (
      <>
        <PanelSection title="打码区域">
          <Hint>打码按区域定位，不参与排版；区域列表与打码方式在「样式」页签。</Hint>
          <Field label={`当前 ${layer.regions.length} 个区域`}>
            <div className="button-row">
              <button
                type="button"
                className="button button-sm"
                onClick={() => moveLayer(layer.id, -1)}
              >
                上移一层
              </button>
              <button
                type="button"
                className="button button-sm"
                onClick={() => moveLayer(layer.id, 1)}
              >
                下移一层
              </button>
            </div>
          </Field>
        </PanelSection>
      </>
    );
  }

  const layout = layer.layout;

  const changeMode = (mode: 'single' | 'tile' | 'grid') => {
    if (mode === layout.mode) return;
    const next =
      mode === 'single' ? singleLayout('bottom-right') : mode === 'tile' ? tileLayout() : gridLayout();
    updateLayer(layer.id, { layout: next });
  };

  return (
    <>
      <PanelSection title="排布方式">
        <Segmented<'single' | 'tile' | 'grid'>
          value={layout.mode}
          ariaLabel="排布方式"
          options={[
            { value: 'single', label: '单点' },
            { value: 'tile', label: '平铺' },
            { value: 'grid', label: '网格' },
          ]}
          onChange={changeMode}
        />

      </PanelSection>

      {layout.mode === 'single' ? (
        <PanelSection title="位置与边距">
          <div className="inline-row">
            <AnchorGrid
              value={layout.anchor}
              onChange={(anchor: Anchor9) => updateLayout(layer.id, { anchor })}
            />
            <div className="grow" style={{ display: 'grid', gap: 6 }}>
              <Slider
                label="边距"
                value={layout.margin}
                min={0}
                max={0.3}
                step={0.005}
                format={(value) => pct(value, 1)}
                onChange={(value) => updateLayout(layer.id, { margin: value }, `margin-${layer.id}`)}
              />
              <div className="nudge-grid">
                <span />
                <button
                  type="button"
                  className="nudge"
                  onClick={() =>
                    updateLayout(layer.id, { offsetY: Number((layout.offsetY - 0.01).toFixed(3)) })
                  }
                >
                  ↑
                </button>
                <span />
                <button
                  type="button"
                  className="nudge"
                  onClick={() =>
                    updateLayout(layer.id, { offsetX: Number((layout.offsetX - 0.01).toFixed(3)) })
                  }
                >
                  ←
                </button>
                <button
                  type="button"
                  className="nudge"
                  title="重置偏移"
                  onClick={() => updateLayout(layer.id, { offsetX: 0, offsetY: 0 })}
                >
                  ·
                </button>
                <button
                  type="button"
                  className="nudge"
                  onClick={() =>
                    updateLayout(layer.id, { offsetX: Number((layout.offsetX + 0.01).toFixed(3)) })
                  }
                >
                  →
                </button>
                <span />
                <button
                  type="button"
                  className="nudge"
                  onClick={() =>
                    updateLayout(layer.id, { offsetY: Number((layout.offsetY + 0.01).toFixed(3)) })
                  }
                >
                  ↓
                </button>
                <span />
              </div>
            </div>
          </div>
          <Slider
            label="水平偏移"
            hint="按画布宽度"
            value={layout.offsetX}
            min={-0.5}
            max={0.5}
            step={0.005}
            format={(value) => pct(value, 1)}
            onChange={(value) => updateLayout(layer.id, { offsetX: value }, `offsetX-${layer.id}`)}
          />
          <Slider
            label="垂直偏移"
            hint="按画布高度"
            value={layout.offsetY}
            min={-0.5}
            max={0.5}
            step={0.005}
            format={(value) => pct(value, 1)}
            onChange={(value) => updateLayout(layer.id, { offsetY: value }, `offsetY-${layer.id}`)}
          />
        </PanelSection>
      ) : null}

      {layout.mode === 'tile' ? (
        <PanelSection title="平铺参数" hint={`旋转 ${deg(layer.rotation)}`}>
          <Slider
            label="水平间距"
            hint="按水印自身宽度"
            value={layout.gapX}
            min={0.05}
            max={4}
            step={0.05}
            format={(value) => pct(value)}
            onChange={(value) => updateLayout(layer.id, { gapX: value }, `gapX-${layer.id}`)}
          />
          <Slider
            label="垂直间距"
            hint="按水印自身高度"
            value={layout.gapY}
            min={0.05}
            max={6}
            step={0.05}
            format={(value) => pct(value)}
            onChange={(value) => updateLayout(layer.id, { gapY: value }, `gapY-${layer.id}`)}
          />
          <Slider
            label="覆盖扩边"
            hint="补上旋转后的四角"
            value={layout.padding}
            min={0}
            max={0.4}
            step={0.01}
            format={(value) => pct(value)}
            onChange={(value) => updateLayout(layer.id, { padding: value }, `pad-${layer.id}`)}
          />
          <SwitchRow
            label="隔行错位（更防盗用）"
            checked={layout.stagger}
            onChange={(value) => updateLayout(layer.id, { stagger: value })}
          />
        </PanelSection>
      ) : null}

      {layout.mode === 'grid' ? (
        <PanelSection title="网格参数">
          <Slider
            label="列数"
            value={layout.cols}
            min={1}
            max={8}
            step={1}
            format={(value) => `${Math.round(value)} 列`}
            onChange={(value) => updateLayout(layer.id, { cols: Math.round(value) }, `cols-${layer.id}`)}
          />
          <Slider
            label="行数"
            value={layout.rows}
            min={1}
            max={8}
            step={1}
            format={(value) => `${Math.round(value)} 行`}
            onChange={(value) => updateLayout(layer.id, { rows: Math.round(value) }, `rows-${layer.id}`)}
          />
          <Slider
            label="外扩边距"
            value={layout.margin}
            min={0}
            max={0.3}
            step={0.005}
            format={(value) => pct(value, 1)}
            onChange={(value) => updateLayout(layer.id, { margin: value }, `gridMargin-${layer.id}`)}
          />
        </PanelSection>
      ) : null}

      <PanelSection title="图层顺序">
        <Field
          label={`第 ${layers.findIndex((item) => item.id === layer.id) + 1} 层，共 ${layers.length} 层`}
        >
          <div className="button-row">
            <button
              type="button"
              className="button button-sm"
              onClick={() => moveLayer(layer.id, -1)}
            >
              上移一层
            </button>
            <button
              type="button"
              className="button button-sm"
              onClick={() => moveLayer(layer.id, 1)}
            >
              下移一层
            </button>
          </div>
        </Field>
        <Hint>图层顺序决定叠放层次，后绘制的图层在上方。</Hint>
      </PanelSection>
    </>
  );
}
