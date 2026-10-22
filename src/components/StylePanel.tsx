import { useRef } from 'react';
import { BLEND_OPTIONS, FONT_OPTIONS } from '../core/defaults';
import { useEditor } from '../state/editorStore';
import type { BlendMode, ImageLayer, TextLayer, WatermarkLayer } from '../core/types';
import {
  ColorField,
  Field,
  Hint,
  PanelSection,
  Segmented,
  SelectField,
  Slider,
  SwitchRow,
  TextArea,
  ButtonRow,
} from './controls';
import { deg, pct } from './format';

export function StylePanel({ layer }: { layer: WatermarkLayer | null }) {
  if (!layer) {
    return (
      <div className="empty-note" style={{ padding: '40px 16px' }}>
        在左侧选择一个图层，或新建一个水印图层。
      </div>
    );
  }
  return layer.type === 'text' ? <TextStyle layer={layer} /> : <ImageStyle layer={layer} />;
}

function CommonSection({ layer }: { layer: WatermarkLayer }) {
  const updateLayer = useEditor((state) => state.updateLayer);
  return (
    <PanelSection title="叠加方式">
      <Slider
        label="不透明度"
        value={layer.opacity}
        min={0.02}
        max={1}
        step={0.01}
        format={(value) => pct(value)}
        onChange={(value) => updateLayer(layer.id, { opacity: value }, `opacity-${layer.id}`)}
      />
      <Slider
        label="旋转"
        value={layer.rotation}
        min={-180}
        max={180}
        step={1}
        format={(value) => deg(value)}
        onChange={(value) => updateLayer(layer.id, { rotation: value }, `rotation-${layer.id}`)}
      />
      <Field label="混合模式">
        <SelectField<BlendMode>
          value={layer.blend}
          options={BLEND_OPTIONS}
          ariaLabel="混合模式"
          onChange={(value) => updateLayer(layer.id, { blend: value })}
        />
      </Field>
    </PanelSection>
  );
}

function TextStyle({ layer }: { layer: TextLayer }) {
  const applyTextPatch = useEditor((state) => state.applyTextPatch);
  const customFonts = useEditor((state) => state.customFonts);
  const addCustomFont = useEditor((state) => state.addCustomFont);
  const pushToast = useEditor((state) => state.pushToast);
  const fontInput = useRef<HTMLInputElement | null>(null);

  const fontOptions = [
    ...FONT_OPTIONS,
    ...customFonts.map((font) => ({ label: `${font.label}（自定义）`, value: font.family })),
  ];

  const handleFontFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const family = `WmFont${Date.now().toString(36)}`;
      const face = new FontFace(family, buffer);
      await face.load();
      document.fonts.add(face);
      addCustomFont({ family: `"${family}"`, label: file.name.replace(/\.[^.]+$/, '') });
      applyTextPatch(layer.id, { fontFamily: `"${family}", sans-serif` });
      pushToast('字体已载入（仅本次会话有效）', 'success');
    } catch {
      pushToast('字体文件无法解析', 'error');
    }
  };

  return (
    <>
      <PanelSection title="文字内容" hint={`${layer.text.length} 字`}>
        <Field label="水印文字" hint="回车换行">
          <TextArea
            value={layer.text}
            rows={3}
            placeholder="例如：仅供办理入职使用"
            onChange={(value) => applyTextPatch(layer.id, { text: value }, `text-${layer.id}`)}
          />
        </Field>
        <Field label="字体">
          <SelectField<string>
            value={layer.fontFamily}
            options={fontOptions}
            ariaLabel="字体"
            onChange={(value) => applyTextPatch(layer.id, { fontFamily: value })}
          />
        </Field>
        <ButtonRow>
          <button
            type="button"
            className="button button-sm"
            onClick={() => fontInput.current?.click()}
          >
            上传自定义字体（ttf / otf / woff2）
          </button>
        </ButtonRow>
        <input
          ref={fontInput}
          type="file"
          accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff2"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void handleFontFile(file);
          }}
        />
        <Hint>自定义字体只保存在当前浏览器会话中，不会写入方案文件。</Hint>
      </PanelSection>

      <PanelSection title="排版">
        <Slider
          label="字号"
          hint="相对图片短边"
          value={layer.fontSize}
          min={0.008}
          max={0.2}
          step={0.001}
          format={(value) => pct(value, 1)}
          onChange={(value) =>
            applyTextPatch(layer.id, { fontSize: value }, `fontSize-${layer.id}`)
          }
        />
        <Field label="字重">
          <Segmented<number>
            value={layer.fontWeight}
            ariaLabel="字重"
            options={[
              { value: 400, label: '常规' },
              { value: 500, label: '中等' },
              { value: 600, label: '半粗' },
              { value: 800, label: '特粗' },
            ]}
            onChange={(value) => applyTextPatch(layer.id, { fontWeight: value })}
          />
        </Field>
        <Slider
          label="字间距"
          value={layer.letterSpacing}
          min={-0.02}
          max={0.4}
          step={0.01}
          format={(value) => pct(value)}
          onChange={(value) =>
            applyTextPatch(layer.id, { letterSpacing: value }, `spacing-${layer.id}`)
          }
        />
        <Slider
          label="行高"
          value={layer.lineHeight}
          min={0.9}
          max={2.4}
          step={0.05}
          format={(value) => value.toFixed(2)}
          onChange={(value) =>
            applyTextPatch(layer.id, { lineHeight: value }, `lineHeight-${layer.id}`)
          }
        />
        <SwitchRow
          label="斜体"
          checked={layer.italic}
          onChange={(value) => applyTextPatch(layer.id, { italic: value })}
        />
      </PanelSection>

      <PanelSection title="颜色">
        <Field label="文字颜色">
          <ColorField
            label="文字颜色"
            value={layer.color}
            onChange={(value) => applyTextPatch(layer.id, { color: value }, `color-${layer.id}`)}
          />
        </Field>
      </PanelSection>

      <PanelSection title="描边" hint={layer.stroke.enabled ? '已开启' : '关闭'}>
        <SwitchRow
          label="启用描边"
          checked={layer.stroke.enabled}
          onChange={(value) =>
            applyTextPatch(layer.id, { stroke: { ...layer.stroke, enabled: value } })
          }
        />
        {layer.stroke.enabled ? (
          <>
            <Slider
              label="描边宽度"
              value={layer.stroke.width}
              min={0.004}
              max={0.08}
              step={0.002}
              format={(value) => pct(value, 1)}
              onChange={(value) =>
                applyTextPatch(layer.id, { stroke: { ...layer.stroke, width: value } }, `stroke-${layer.id}`)
              }
            />
            <Field label="描边颜色">
              <ColorField
                label="描边颜色"
                value={layer.stroke.color}
                onChange={(value) =>
                  applyTextPatch(layer.id, { stroke: { ...layer.stroke, color: value } }, `strokeColor-${layer.id}`)
                }
              />
            </Field>
          </>
        ) : null}
      </PanelSection>

      <PanelSection
        title="阴影"
        hint={layer.shadow.enabled ? '已开启' : '关闭'}
      >
        <SwitchRow
          label="启用阴影"
          checked={layer.shadow.enabled}
          onChange={(value) =>
            applyTextPatch(layer.id, { shadow: { ...layer.shadow, enabled: value } })
          }
        />
        {layer.shadow.enabled ? (
          <>
            <Slider
              label="模糊"
              value={layer.shadow.blur}
              min={0}
              max={1}
              step={0.02}
              format={(value) => pct(value)}
              onChange={(value) =>
                applyTextPatch(layer.id, { shadow: { ...layer.shadow, blur: value } }, `shadow-${layer.id}`)
              }
            />
            <Slider
              label="水平偏移"
              value={layer.shadow.offsetX}
              min={-0.2}
              max={0.2}
              step={0.01}
              format={(value) => pct(value)}
              onChange={(value) =>
                applyTextPatch(layer.id, { shadow: { ...layer.shadow, offsetX: value } }, `shadowX-${layer.id}`)
              }
            />
            <Slider
              label="垂直偏移"
              value={layer.shadow.offsetY}
              min={-0.2}
              max={0.2}
              step={0.01}
              format={(value) => pct(value)}
              onChange={(value) =>
                applyTextPatch(layer.id, { shadow: { ...layer.shadow, offsetY: value } }, `shadowY-${layer.id}`)
              }
            />
            <Field label="阴影颜色">
              <ColorField
                label="阴影颜色"
                value={layer.shadow.color}
                onChange={(value) =>
                  applyTextPatch(layer.id, { shadow: { ...layer.shadow, color: value } }, `shadowColor-${layer.id}`)
                }
              />
            </Field>
          </>
        ) : null}
      </PanelSection>

      <PanelSection
        title="背景色块"
        hint={layer.chip.enabled ? '已开启' : '关闭'}
      >
        <SwitchRow
          label="文字背后加色块（标签条）"
          checked={layer.chip.enabled}
          onChange={(value) =>
            applyTextPatch(layer.id, { chip: { ...layer.chip, enabled: value } })
          }
        />
        {layer.chip.enabled ? (
          <>
            <Field label="色块颜色">
              <ColorField
                label="色块颜色"
                value={layer.chip.color}
                onChange={(value) =>
                  applyTextPatch(layer.id, { chip: { ...layer.chip, color: value } }, `chipColor-${layer.id}`)
                }
              />
            </Field>
            <Slider
              label="色块不透明度"
              value={layer.chip.opacity}
              min={0.1}
              max={1}
              step={0.02}
              format={(value) => pct(value)}
              onChange={(value) =>
                applyTextPatch(layer.id, { chip: { ...layer.chip, opacity: value } }, `chipOpacity-${layer.id}`)
              }
            />
            <Slider
              label="内边距"
              value={layer.chip.padding}
              min={0.05}
              max={1.2}
              step={0.02}
              format={(value) => pct(value)}
              onChange={(value) =>
                applyTextPatch(layer.id, { chip: { ...layer.chip, padding: value } }, `chipPad-${layer.id}`)
              }
            />
            <Slider
              label="圆角"
              value={layer.chip.radius}
              min={0}
              max={1.2}
              step={0.02}
              format={(value) => pct(value)}
              onChange={(value) =>
                applyTextPatch(layer.id, { chip: { ...layer.chip, radius: value } }, `chipRadius-${layer.id}`)
              }
            />
          </>
        ) : null}
      </PanelSection>

      <CommonSection layer={layer} />
    </>
  );
}

function ImageStyle({ layer }: { layer: ImageLayer }) {
  const updateLayer = useEditor((state) => state.updateLayer);
  return (
    <>
      <PanelSection title="Logo">
        <div className="logo-preview">
          <img src={layer.src} alt="Logo 预览" />
          <span>
            透明 PNG / SVG 效果最好
            <br />
            尺寸按图片短边等比缩放
          </span>
        </div>
        <Slider
          label="宽度"
          hint="相对图片短边"
          value={layer.scale}
          min={0.02}
          max={0.9}
          step={0.005}
          format={(value) => pct(value, 1)}
          onChange={(value) => updateLayer(layer.id, { scale: value }, `scale-${layer.id}`)}
        />
      </PanelSection>
      <CommonSection layer={layer} />
    </>
  );
}
