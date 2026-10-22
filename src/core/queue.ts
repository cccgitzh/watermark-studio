import type { ImageItem } from './types';

/** 可参与渲染与导出的图片：状态就绪且拿到了像素 */
export type ReadyImage = ImageItem & { status: 'ready'; bitmap: ImageBitmap };

export const isReadyImage = (item: ImageItem): item is ReadyImage =>
  item.status === 'ready' && item.bitmap !== null;

/** 待处理数量：排除读取失败与被跳过的图片 */
export const countPending = (images: ImageItem[]): number =>
  images.filter((item) => isReadyImage(item) && !item.skipped).length;
