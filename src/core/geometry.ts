import type { Anchor9, LayoutConfig, Point, Size } from './types';

/**
 * 计算水印锚点（锚点 = 水印内容的中心）。
 * 所有布局都以「内容尺寸 + 旋转角」为输入，返回一组中心坐标。
 */
export function computeAnchors(
  layout: LayoutConfig,
  canvas: Size,
  content: Size,
  rotationDeg: number,
): Point[] {
  const { width: W, height: H } = canvas;
  const shortEdge = Math.min(W, H);

  switch (layout.mode) {
    case 'single':
      return singleAnchor(layout.anchor, layout.margin, layout.offsetX, layout.offsetY, canvas, content);

    case 'grid': {
      const cols = Math.max(1, Math.round(layout.cols));
      const rows = Math.max(1, Math.round(layout.rows));
      const margin = clamp(layout.margin, 0, 0.45) * shortEdge;
      const usableW = Math.max(1, W - margin * 2);
      const usableH = Math.max(1, H - margin * 2);
      const points: Point[] = [];
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          points.push({
            x: margin + ((c + 0.5) * usableW) / cols,
            y: margin + ((r + 0.5) * usableH) / rows,
          });
        }
      }
      return points;
    }

    case 'tile': {
      const rad = (rotationDeg * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const pad = clamp(layout.padding, 0, 0.5);
      // 旋转后的安全覆盖区域
      const spanW = W * cos + H * sin;
      const spanH = W * sin + H * cos;
      const extW = spanW * (1 + pad * 2);
      const extH = spanH * (1 + pad * 2);

      const stepX = Math.max(4, content.width * (1 + Math.max(0, layout.gapX)));
      const stepY = Math.max(4, content.height * (1 + Math.max(0, layout.gapY)));
      const cols = Math.ceil(extW / stepX) + 1;
      const rows = Math.ceil(extH / stepY) + 1;
      const startX = W / 2 - (cols * stepX) / 2 + stepX / 2;
      const startY = H / 2 - (rows * stepY) / 2 + stepY / 2;

      const points: Point[] = [];
      const limit = 10000; // 极端参数下的保护，避免渲染卡死
      for (let r = 0; r < rows; r += 1) {
        const shift = layout.stagger && r % 2 === 1 ? stepX / 2 : 0;
        for (let c = 0; c < cols; c += 1) {
          points.push({ x: startX + c * stepX + shift, y: startY + r * stepY });
          if (points.length >= limit) return points;
        }
      }
      return points;
    }

    default:
      return [{ x: W / 2, y: H / 2 }];
  }
}

function singleAnchor(
  anchor: Anchor9,
  marginRatio: number,
  offsetXRatio: number,
  offsetYRatio: number,
  canvas: Size,
  content: Size,
): Point[] {
  const { width: W, height: H } = canvas;
  const margin = clamp(marginRatio, 0, 0.45) * Math.min(W, H);
  const halfW = content.width / 2;
  const halfH = content.height / 2;

  let x = W / 2;
  let y = H / 2;

  switch (anchor) {
    case 'top-left':
      x = margin + halfW;
      y = margin + halfH;
      break;
    case 'top':
      y = margin + halfH;
      break;
    case 'top-right':
      x = W - margin - halfW;
      y = margin + halfH;
      break;
    case 'left':
      x = margin + halfW;
      break;
    case 'right':
      x = W - margin - halfW;
      break;
    case 'bottom-left':
      x = margin + halfW;
      y = H - margin - halfH;
      break;
    case 'bottom':
      y = H - margin - halfH;
      break;
    case 'bottom-right':
      x = W - margin - halfW;
      y = H - margin - halfH;
      break;
    case 'center':
    default:
      break;
  }

  return [
    {
      x: x + clamp(offsetXRatio, -1, 1) * W,
      y: y + clamp(offsetYRatio, -1, 1) * H,
    },
  ];
}

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** 估算导出画布尺寸（长边限制，不放大） */
export function fitSize(size: Size, maxSize: number): Size {
  const longEdge = Math.max(size.width, size.height);
  if (!maxSize || longEdge <= maxSize) return { ...size };
  const ratio = maxSize / longEdge;
  return {
    width: Math.max(1, Math.round(size.width * ratio)),
    height: Math.max(1, Math.round(size.height * ratio)),
  };
}
