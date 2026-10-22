import { encodeCanvas } from '../core/export';
import { renderComposite } from '../core/renderer';
import type { TextVars, WatermarkLayer } from '../core/types';

export interface WorkerRenderJob {
  id: string;
  bitmap: ImageBitmap;
  width: number;
  height: number;
  layers: WatermarkLayer[];
  logos: Record<string, ImageBitmap>;
  vars?: TextVars;
  mime: string;
  quality: number;
  flattenColor: string;
}

export type WorkerRequest = { type: 'render'; job: WorkerRenderJob };

export type WorkerResponse =
  | { type: 'done'; id: string; blob: Blob; width: number; height: number }
  | { type: 'error'; id: string; message: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { data } = event;
  if (data?.type !== 'render') return;
  const job = data.job;

  try {
    const canvas = new OffscreenCanvas(job.width, job.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 上下文不可用');

    if (job.mime === 'image/jpeg') {
      ctx.fillStyle = job.flattenColor || '#ffffff';
      ctx.fillRect(0, 0, job.width, job.height);
    }

    renderComposite(ctx, job.bitmap, {
      width: job.width,
      height: job.height,
      layers: job.layers,
      logos: job.logos,
      vars: job.vars,
    });

    const blob = await encodeCanvas(canvas, job.mime, job.quality);
    scope.postMessage({ type: 'done', id: job.id, blob, width: job.width, height: job.height });
  } catch (error) {
    scope.postMessage({
      type: 'error',
      id: job.id,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    job.bitmap.close();
    Object.values(job.logos).forEach((bitmap) => bitmap.close());
  }
};
