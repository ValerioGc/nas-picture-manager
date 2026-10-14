import type { ImageSize } from '@/services/annotations';
import type { CropRectangle, ImageAnnotation, ImagePoint } from '@/types/types';

export function moveAnnotation(
  item: ImageAnnotation,
  bounds: CropRectangle,
  size: ImageSize,
  delta: ImagePoint,
): Partial<ImageAnnotation> {
  return {
    x: item.x + Math.max(-bounds.x, Math.min(size.width - bounds.x - bounds.width, delta.x)),
    y: item.y + Math.max(-bounds.y, Math.min(size.height - bounds.y - bounds.height, delta.y)),
  };
}

export function resizeAnnotation(
  item: ImageAnnotation,
  current: ImagePoint,
  square: boolean,
): Partial<ImageAnnotation> {
  let width = current.x - item.x;
  let height = current.y - item.y;
  if (item.kind === 'circle' || (item.kind === 'rectangle' && square)) {
    const edge = Math.min(Math.abs(width), Math.abs(height));
    width = Math.sign(width) * edge;
    height = Math.sign(height) * edge;
  }
  if (item.kind === 'line') {
    return { width, height };
  }
  return {
    x: item.x + Math.min(0, width),
    y: item.y + Math.min(0, height),
    width: Math.abs(width),
    height: Math.abs(height),
  };
}

export function resizeTextAnnotation(
  item: ImageAnnotation,
  current: ImagePoint,
  bounds: CropRectangle,
): Partial<ImageAnnotation> {
  const fontSize = Math.max(
    8,
    Math.min(200, Math.round((item.style.fontSize * (current.y - item.y)) / bounds.height)),
  );
  return { style: { ...item.style, fontSize } };
}

export function resizeWithKeyboard(
  item: ImageAnnotation,
  direction: ImagePoint,
  step: number,
  dx: number,
  dy: number,
): Partial<ImageAnnotation> {
  if (item.kind === 'text') {
    return {
      style: {
        ...item.style,
        fontSize: Math.min(
          200,
          Math.max(8, item.style.fontSize + (direction.x || direction.y) * step),
        ),
      },
    };
  }
  if (item.kind === 'circle') {
    const edge = Math.max(1, item.width + (dx || dy));
    return { width: edge, height: edge };
  }
  return {
    width: item.kind === 'line' ? item.width + dx : Math.max(1, item.width + dx),
    height: item.kind === 'line' ? item.height + dy : Math.max(1, item.height + dy),
  };
}
