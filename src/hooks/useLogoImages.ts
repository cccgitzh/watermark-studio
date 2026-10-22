import { useEffect, useRef, useState } from 'react';
import { dataUrlToBitmap } from '../core/imageSource';
import type { ImageSources, WatermarkLayer } from '../core/types';

/**
 * 把图层里的 dataURL Logo 解码成可绘制的位图，按 dataURL 缓存，避免每次重绘都重新解码。
 */
export function useLogoImages(layers: WatermarkLayer[]): ImageSources {
  const cache = useRef<Map<string, ImageBitmap>>(new Map());
  const [logos, setLogos] = useState<ImageSources>({});

  // 只关心「哪些 Logo、内容是否变化」，避免文字微调时重复解码
  const signature = layers
    .filter((layer) => layer.type === 'image')
    .map((layer) => `${layer.id}:${layer.src.length}:${layer.src.slice(-32)}`)
    .join('|');

  useEffect(() => {
    let cancelled = false;
    const imageLayers = layers.filter((layer) => layer.type === 'image');
    if (!imageLayers.length) {
      setLogos({});
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const next: ImageSources = {};
      for (const layer of imageLayers) {
        if (layer.type !== 'image') continue;
        let bitmap = cache.current.get(layer.src);
        if (!bitmap) {
          try {
            bitmap = await dataUrlToBitmap(layer.src);
            cache.current.set(layer.src, bitmap);
          } catch {
            continue;
          }
        }
        next[layer.id] = bitmap;
      }
      if (!cancelled) setLogos(next);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return logos;
}
