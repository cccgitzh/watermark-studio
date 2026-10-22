import { encodeCanvas } from '../core/export';
import { renderComposite } from '../core/renderer';
import type { WatermarkLayer } from '../core/types';
import type { WorkerRenderJob, WorkerRequest, WorkerResponse } from './render.worker';

export interface RenderJobInput {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  layers: WatermarkLayer[];
  logos: Record<string, ImageBitmap>;
  mime: string;
  quality: number;
  flattenColor: string;
}

export interface RenderOutput {
  blob: Blob;
  width: number;
  height: number;
}

let seq = 0;
const nextId = () => `job_${(seq += 1)}`;

interface Pending {
  resolve: (value: RenderOutput) => void;
  reject: (reason: Error) => void;
}

interface WorkerSlot {
  worker: Worker;
  busy: boolean;
}

/**
 * 渲染池：优先用 OffscreenCanvas + Web Worker，避免批量处理时主线程卡死。
 * 不支持 OffscreenCanvas 或自定义字体等场景自动回退到主线程渲染。
 */
export class RenderPool {
  private slots: WorkerSlot[] = [];
  private pending = new Map<string, Pending>();
  private queue: { id: string; job: WorkerRenderJob }[] = [];
  private destroyed = false;
  private readonly size: number;
  readonly mode: 'worker' | 'main';

  constructor(size = 2) {
    const supported =
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      typeof createImageBitmap === 'function';
    this.mode = supported ? 'worker' : 'main';
    this.size = Math.max(1, Math.min(4, size));
    if (this.mode === 'worker') {
      for (let i = 0; i < this.size; i += 1) this.slots.push(this.spawn());
    }
  }

  private spawn(): WorkerSlot {
    const worker = new Worker(new URL('./render.worker.ts', import.meta.url), {
      type: 'module',
      name: 'watermark-renderer',
    });
    const slot: WorkerSlot = { worker, busy: false };

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      if (!data) return;
      const entry = this.pending.get(data.id);
      this.pending.delete(data.id);
      slot.busy = false;
      if (data.type === 'done') {
        entry?.resolve({ blob: data.blob, width: data.width, height: data.height });
      } else {
        entry?.reject(new Error(data.message || '渲染失败'));
      }
      this.pump();
    };

    worker.onerror = (event) => {
      const message = event.message || '渲染线程异常';
      for (const [id, entry] of this.pending) {
        entry.reject(new Error(message));
        this.pending.delete(id);
      }
      slot.busy = false;
      this.pump();
    };

    return slot;
  }

  render(input: RenderJobInput): Promise<RenderOutput> {
    if (this.destroyed) return Promise.reject(new Error('渲染池已销毁'));
    if (this.mode === 'main') return renderOnMainThread(input);

    const id = nextId();
    const job: WorkerRenderJob = { id, ...input };
    return new Promise<RenderOutput>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.queue.push({ id, job });
      this.pump();
    });
  }

  private pump(): void {
    if (this.mode !== 'worker') return;
    for (const slot of this.slots) {
      if (slot.busy) continue;
      const next = this.queue.shift();
      if (!next) return;
      slot.busy = true;
      const request: WorkerRequest = { type: 'render', job: next.job };
      slot.worker.postMessage(request);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.queue = [];
    for (const [, entry] of this.pending) entry.reject(new Error('任务已取消'));
    this.pending.clear();
    this.slots.forEach((slot) => slot.worker.terminate());
    this.slots = [];
  }
}

/** 主线程渲染：worker 不可用、或使用了自定义字体时的兜底路径 */
export async function renderOnMainThread(input: RenderJobInput): Promise<RenderOutput> {
  const canvas = document.createElement('canvas');
  canvas.width = input.width;
  canvas.height = input.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布上下文');

  if (input.mime === 'image/jpeg') {
    ctx.fillStyle = input.flattenColor || '#ffffff';
    ctx.fillRect(0, 0, input.width, input.height);
  }

  renderComposite(ctx, input.bitmap, {
    width: input.width,
    height: input.height,
    layers: input.layers,
    logos: input.logos,
  });

  const blob = await encodeCanvas(canvas, input.mime, input.quality);
  return { blob, width: input.width, height: input.height };
}
