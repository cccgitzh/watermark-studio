import { useRef, useState } from 'react';
import { cloneDoc } from '../core/defaults';
import { downloadBlob } from '../core/export';
import { useEditor } from '../state/editorStore';
import type { Preset, WatermarkLayer } from '../core/types';
import { ButtonRow, Field, Hint, PanelSection, TextInput } from './controls';
import { IconSparkle, IconTrash } from './icons';

interface PresetFile {
  app?: string;
  version?: number;
  preset?: { name?: string; layers?: WatermarkLayer[]; exportSettings?: Preset['exportSettings'] };
}

const isPresetLike = (value: unknown): value is PresetFile => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as PresetFile;
  const layers = candidate.preset?.layers ?? (value as { layers?: WatermarkLayer[] }).layers;
  return Array.isArray(layers) && layers.length > 0;
};

export function PresetPanel() {
  const presets = useEditor((state) => state.presets);
  const applyPreset = useEditor((state) => state.applyPreset);
  const savePreset = useEditor((state) => state.savePreset);
  const deletePreset = useEditor((state) => state.deletePreset);
  const layers = useEditor((state) => state.layers);
  const exportSettings = useEditor((state) => state.exportSettings);
  const pushToast = useEditor((state) => state.pushToast);
  const [name, setName] = useState('');
  const fileInput = useRef<HTMLInputElement | null>(null);

  const builtin = presets.filter((preset) => preset.builtin);
  const custom = presets.filter((preset) => !preset.builtin);

  const handleExport = () => {
    const payload = {
      app: 'watermark-studio',
      version: 1,
      preset: { name: '我的水印方案', layers: cloneDoc(layers), exportSettings },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'watermark-preset.json');
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!isPresetLike(parsed)) throw new Error('格式不符');
      const candidate = parsed as PresetFile & { layers?: WatermarkLayer[]; name?: string };
      const importedLayers = candidate.preset?.layers ?? candidate.layers ?? [];
      const importedName = candidate.preset?.name ?? candidate.name ?? '导入的方案';
      applyPreset({
        id: `imported-${Date.now()}`,
        name: importedName,
        layers: importedLayers,
        exportSettings: candidate.preset?.exportSettings,
      });
      pushToast('方案已导入', 'success');
    } catch {
      pushToast('方案文件解析失败', 'error');
    }
  };

  return (
    <>
      <PanelSection title="内置方案" hint={`${builtin.length} 个`}>
        <div className="preset-grid">
          {builtin.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="preset-card"
              onClick={() => applyPreset(preset)}
            >
              <span className="preset-name">{preset.name}</span>
              <span className="preset-meta">{describePreset(preset)}</span>
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="我的方案" hint={custom.length ? `${custom.length} 个` : '暂无'}>
        {custom.length ? (
          <div className="preset-grid">
            {custom.map((preset) => (
              <div key={preset.id} className="preset-card" style={{ cursor: 'default' }}>
                <button
                  type="button"
                  style={{ all: 'unset', cursor: 'pointer', display: 'block' }}
                  onClick={() => applyPreset(preset)}
                >
                  <span className="preset-name">{preset.name}</span>
                  <span className="preset-meta">{describePreset(preset)}</span>
                </button>
                <button
                  type="button"
                  className="preset-delete"
                  title="删除方案"
                  onClick={() => deletePreset(preset.id)}
                >
                  <IconTrash size={11} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Hint>把当前配置存成方案，下次一键套用。</Hint>
        )}
        <Field label="方案名称">
          <TextInput
            value={name}
            placeholder="例如：公司证件水印"
            onChange={setName}
            onEnter={() => {
              savePreset(name);
              setName('');
            }}
          />
        </Field>
        <ButtonRow>
          <button
            type="button"
            className="button button-sm"
            disabled={!name.trim() || !layers.length}
            onClick={() => {
              savePreset(name);
              setName('');
            }}
          >
            <IconSparkle size={13} />
            保存当前配置
          </button>
        </ButtonRow>
      </PanelSection>

      <PanelSection title="方案文件">
        <ButtonRow>
          <button type="button" className="button button-sm" onClick={handleExport}>
            导出 JSON
          </button>
          <button
            type="button"
            className="button button-sm"
            onClick={() => fileInput.current?.click()}
          >
            导入 JSON
          </button>
        </ButtonRow>
        <Hint>方案文件不包含图片，可安全分享给同事复用同一套水印参数。</Hint>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void handleImport(file);
          }}
        />
      </PanelSection>
    </>
  );
}

function describePreset(preset: Preset): string {
  const layer = preset.layers[0];
  if (!layer) return '空方案';
  if (layer.type === 'redact') {
    return `${preset.layers.length} 图层 · 打码 ${layer.regions.length} 区域`;
  }
  const mode =
    layer.layout.mode === 'tile' ? '平铺' : layer.layout.mode === 'grid' ? '网格' : '单点';
  return `${preset.layers.length} 图层 · ${mode} · ${Math.round(layer.opacity * 100)}%`;
}
