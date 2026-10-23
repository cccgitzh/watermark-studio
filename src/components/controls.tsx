import { useId, type ReactNode } from 'react';
import { ANCHOR_OPTIONS } from '../core/defaults';
import type { Anchor9 } from '../core/types';
import { IconChevron } from './icons';

export function PanelSection({
  title,
  hint,
  children,
  open = true,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="section" open={open}>
      <summary className="section-head">
        <span className="section-title">{title}</span>
        {hint ? <span className="section-hint">{hint}</span> : null}
        <IconChevron size={14} className="section-chevron" />
      </summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

export function Field({
  label,
  hint,
  children,
  stack,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
  stack?: boolean;
}) {
  return (
    <div className={stack ? 'field field-stack' : 'field'}>
      {label ? (
        <label className="field-label">
          {label}
          {hint ? <span className="field-hint">{hint}</span> : null}
        </label>
      ) : null}
      <div className="field-control">{children}</div>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  hint?: string;
}) {
  const id = useId();
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider-field">
      <div className="slider-head">
        <label htmlFor={id} className="field-label">
          {label}
          {hint ? <span className="field-hint">{hint}</span> : null}
        </label>
        <output className="slider-value" htmlFor={id}>
          {format ? format(value) : value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--fill' as string]: `${Math.max(0, Math.min(100, percent))}%` }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  // 单选组：← → 切换并移动焦点，Tab 只停在当前项
  const current = options.findIndex((option) => option.value === value);
  const step = (delta: number) => {
    const next = options[(current + delta + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(`[data-segmented="${String(next.value)}"]`)
        ?.focus();
    });
  };

  return (
    <div
      className="segmented"
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          step(1);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          step(-1);
        }
      }}
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          data-segmented={String(option.value)}
          className={option.value === value ? 'segmented-item is-active' : 'segmented-item'}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={checked ? 'switch is-on' : 'switch'}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-label">{label}</span>
      <span className="switch-track" aria-hidden>
        <span className="switch-thumb" />
      </span>
    </button>
  );
}

export function ColorField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const hex = normalizeHex(value);
  return (
    <div className="color-field">
      <span className="color-swatch" style={{ background: value }}>
        <input
          type="color"
          value={hex}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
      <input
        className="input input-mono"
        value={value}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`${label}（可输入 rgba）`}
      />
    </div>
  );
}

function normalizeHex(value: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());
  return match ? value.trim() : '#000000';
}

export function TextInput({
  value,
  onChange,
  placeholder,
  mono,
  onEnter,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  onEnter?: () => void;
}) {
  return (
    <input
      className={mono ? 'input input-mono' : 'input'}
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && onEnter) onEnter();
      }}
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      className="input textarea"
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function SelectField<T extends string | number>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <div className="select-wrap">
      <select
        className="select"
        aria-label={ariaLabel}
        value={String(value)}
        onChange={(event) => {
          const raw = event.target.value;
          const matched = options.find((option) => String(option.value) === raw);
          if (matched) onChange(matched.value);
        }}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      <IconChevron size={14} className="select-chevron" />
    </div>
  );
}

export function AnchorGrid({
  value,
  onChange,
}: {
  value: Anchor9;
  onChange: (value: Anchor9) => void;
}) {
  return (
    <div className="anchor-grid" role="radiogroup" aria-label="水印位置">
      {ANCHOR_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          aria-label={option.label}
          title={option.label}
          className={option.value === value ? 'anchor-cell is-active' : 'anchor-cell'}
          onClick={() => onChange(option.value)}
        />
      ))}
    </div>
  );
}

export function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="switch-row">
      <Toggle label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="hint">{children}</p>;
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <div className="button-row">{children}</div>;
}
