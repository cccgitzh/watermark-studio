import { useState } from 'react';
import { useEditor } from '../state/editorStore';
import { ExportPanel } from './ExportPanel';
import { LayoutPanel } from './LayoutPanel';
import { PresetPanel } from './PresetPanel';
import { StylePanel } from './StylePanel';
import { IconLayers, IconSparkle } from './icons';

type TabKey = 'style' | 'layout' | 'export' | 'preset';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'style', label: '样式' },
  { key: 'layout', label: '布局' },
  { key: 'export', label: '导出' },
  { key: 'preset', label: '方案' },
];

export function Inspector() {
  const [tab, setTab] = useState<TabKey>('style');
  const layer = useEditor(
    (state) => state.layers.find((item) => item.id === state.selectedId) ?? null,
  );

  return (
    <aside className="inspector">
      <div className="tabs" role="tablist" aria-label="属性面板">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={tab === item.key ? 'tab is-active' : 'tab'}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="panel-head" style={{ height: 38 }}>
        <span className="panel-title" style={{ fontSize: 10.5 }}>
          {tab === 'style'
            ? layer
              ? layer.name
              : '未选择图层'
            : tab === 'layout'
              ? '排布与定位'
              : tab === 'export'
                ? '导出设置'
                : '方案库'}
        </span>
        <div className="spacer" />
        {tab === 'style' && layer ? (
          <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>
            {layer.type === 'text' ? '文字图层' : '图片图层'}
          </span>
        ) : null}
        {tab === 'preset' ? <IconSparkle size={13} style={{ color: 'var(--muted)' }} /> : null}
        {tab === 'layout' ? <IconLayers size={13} style={{ color: 'var(--muted)' }} /> : null}
      </div>

      <div className="panel-scroll">
        <div className="inspector-body">
          {tab === 'style' ? <StylePanel layer={layer} /> : null}
          {tab === 'layout' ? <LayoutPanel layer={layer} /> : null}
          {tab === 'export' ? <ExportPanel /> : null}
          {tab === 'preset' ? <PresetPanel /> : null}
        </div>
      </div>
    </aside>
  );
}
