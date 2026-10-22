import { resolveMime, extFromMime, buildFileName } from '../core/export';
import { fitSize } from '../core/geometry';
import { runBatch } from '../features/batchExport';
import { useEditor } from '../state/editorStore';
import type { ExportFormat } from '../core/types';
import {
  ButtonRow,
  ColorField,
  Field,
  Hint,
  PanelSection,
  Segmented,
  SelectField,
  Slider,
  TextInput,
} from './controls';
import { pct } from './format';
import { IconCopy, IconDownload } from './icons';

export function ExportPanel() {
  const settings = useEditor((state) => state.exportSettings);
  const setExportSettings = useEditor((state) => state.setExportSettings);
  const images = useEditor((state) => state.images);
  const activeImage = useEditor(
    (state) => state.images.find((item) => item.id === state.activeImageId) ?? null,
  );

  const pending = images.filter((item) => !item.skipped);
  const mime = resolveMime(settings.format, activeImage?.mime ?? 'image/jpeg');
  const ext = extFromMime(mime);
  const outputSize = activeImage
    ? fitSize({ width: activeImage.width, height: activeImage.height }, settings.maxSize)
    : null;
  const sampleName = buildFileName(settings.nameTemplate, {
    name: activeImage?.name ?? 'IMG_0001.jpg',
    index: 0,
    width: outputSize?.width ?? 1920,
    height: outputSize?.height ?? 1080,
    ext,
  });
  const lossy = mime === 'image/jpeg' || mime === 'image/webp';

  return (
    <>
      <PanelSection title="输出格式">
        <Field label="格式">
          <Segmented<ExportFormat>
            value={settings.format}
            ariaLabel="输出格式"
            options={[
              { value: 'original', label: '原格式' },
              { value: 'png', label: 'PNG' },
              { value: 'jpeg', label: 'JPEG' },
              { value: 'webp', label: 'WebP' },
            ]}
            onChange={(value) => setExportSettings({ format: value })}
          />
        </Field>
        {lossy ? (
          <Slider
            label="压缩质量"
            value={settings.quality}
            min={0.4}
            max={1}
            step={0.01}
            format={(value) => pct(value)}
            onChange={(value) => setExportSettings({ quality: value })}
          />
        ) : null}
        <Field label="长边上限">
          <SelectField<number>
            value={settings.maxSize}
            ariaLabel="长边上限"
            options={[
              { value: 0, label: '保持原尺寸' },
              { value: 1280, label: '1280 px' },
              { value: 1920, label: '1920 px' },
              { value: 2560, label: '2560 px' },
              { value: 3840, label: '3840 px（4K）' },
              { value: 8192, label: '8192 px' },
            ]}
            onChange={(value) => setExportSettings({ maxSize: value })}
          />
        </Field>
        {mime === 'image/jpeg' ? (
          <Field label="透明区域填充色" hint="JPEG 不支持透明">
            <ColorField
              label="填充色"
              value={settings.flattenColor}
              onChange={(value) => setExportSettings({ flattenColor: value })}
            />
          </Field>
        ) : null}
        <Hint>PNG 保留透明，JPEG 体积最小，WebP 兼顾两者。</Hint>
      </PanelSection>

      <PanelSection title="文件命名">
        <Field label="命名模板">
          <TextInput
            mono
            value={settings.nameTemplate}
            placeholder="{name}-watermark.{ext}"
            onChange={(value) => setExportSettings({ nameTemplate: value })}
          />
        </Field>
        <div className="token-list">
          <span className="token">{'{name}'}</span>
          <span className="token">{'{index}'}</span>
          <span className="token">{'{date}'}</span>
          <span className="token">{'{w}'}</span>
          <span className="token">{'{h}'}</span>
          <span className="token">{'{ext}'}</span>
        </div>
        <p className="file-preview">示例：{sampleName}</p>
      </PanelSection>

      <PanelSection title="导出">
        <div className="export-facts">
          <span>
            <b className="num">{pending.length}</b> 张待处理
          </span>
          <span className="dot" aria-hidden="true" />
          <span>{ext.toUpperCase()}</span>
          <span className="dot" aria-hidden="true" />
          <span className="num">
            {outputSize ? `${outputSize.width} × ${outputSize.height}` : '—'}
          </span>
        </div>

        <button
          type="button"
          className="button button-block"
          disabled={!pending.length}
          onClick={() => void runBatch('zip')}
        >
          <IconDownload size={14} />
          导出全部（ZIP）
        </button>
        <ButtonRow>
          <button
            type="button"
            className="button button-sm"
            disabled={!pending.length}
            onClick={() => void runBatch('files')}
          >
            逐张下载
          </button>
          <button
            type="button"
            className="button button-sm"
            disabled={!activeImage}
            onClick={() => void runBatch('current')}
          >
            仅当前图片
          </button>
        </ButtonRow>
        <ButtonRow>
          <button
            type="button"
            className="button button-sm button-ghost"
            disabled={!activeImage}
            onClick={() => void runBatch('copy')}
          >
            <IconCopy size={13} />
            复制当前到剪贴板
          </button>
        </ButtonRow>
        <Hint>处理在浏览器本地完成，不产生任何网络请求。</Hint>
      </PanelSection>
    </>
  );
}
