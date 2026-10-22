import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useEditor } from '../state/editorStore';
import { ExportPanel } from './ExportPanel';
import { LayoutPanel } from './LayoutPanel';
import { PresetPanel } from './PresetPanel';
import { StylePanel } from './StylePanel';

type TabKey = 'style' | 'layout' | 'export' | 'preset';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'style', label: '样式' },
  { key: 'layout', label: '布局' },
  { key: 'export', label: '导出' },
  { key: 'preset', label: '方案' },
];

export function Inspector() {
  const [tab, setTab] = useState<TabKey>('style');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const layer = useEditor(
    (state) => state.layers.find((item) => item.id === state.selectedId) ?? null,
  );

  // ← → 在页签间移动，Home / End 跳到首尾
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta =
      event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowLeft'
          ? -1
          : event.key === 'Home'
            ? -index
            : event.key === 'End'
              ? TABS.length - 1 - index
              : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + TABS.length) % TABS.length;
    setTab(TABS[next].key);
    tabRefs.current[next]?.focus();
  };

  return (
    <aside className="inspector" aria-label="属性面板">
      <div className="tabs" role="tablist" aria-label="属性分类">
        {TABS.map((item, index) => (
          <button
            key={item.key}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`tab-${item.key}`}
            aria-controls={`panel-${item.key}`}
            aria-selected={tab === item.key}
            tabIndex={tab === item.key ? 0 : -1}
            className={tab === item.key ? 'tab is-active' : 'tab'}
            onClick={() => setTab(item.key)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        className="panel-scroll"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
      >
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
