import { ImageClientError } from '@/composables/imageErrors';
import type { CropRectangle, ImageAnnotation, ImageEdits, ImagePoint } from '@/types/types';

export interface ImageSize {
  width: number;
  height: number;
}

export function annotationDimensions(size: ImageSize, edits: ImageEdits): ImageSize {
  const rotated = edits.rotation % 2 ? { width: size.height, height: size.width } : size;
  return edits.crop ?? rotated;
}

export function annotationPoint(
  point: ImagePoint,
  size: ImageSize,
  edits: ImageEdits,
  inverse = false,
): ImagePoint {
  const rotated = edits.rotation % 2 ? { width: size.height, height: size.width } : size;
  let { x, y } = point;
  if (inverse) {
    x += edits.crop?.x ?? 0;
    y += edits.crop?.y ?? 0;
  } else {
    [x, y] = rotatePoint(x, y, size, edits.rotation);
  }

  if (edits.flipHorizontal) {
    x = rotated.width - x;
  }

  if (edits.flipVertical) {
    y = rotated.height - y;
  }

  if (inverse) {
    [x, y] = rotatePoint(x, y, rotated, (4 - edits.rotation) % 4);
  } else {
    x -= edits.crop?.x ?? 0;
    y -= edits.crop?.y ?? 0;
  }
  return { x, y };
}

function rotatePoint(x: number, y: number, size: ImageSize, rotation: number): [number, number] {
  switch (rotation) {
    case 1:
      return [size.height - y, x];
    case 2:
      return [size.width - x, size.height - y];
    case 3:
      return [y, size.width - x];
    default:
      return [x, y];
  }
}

export function annotationBounds(
  item: ImageAnnotation,
  context: CanvasRenderingContext2D,
): CropRectangle {
  let { width, height } = item;
  if (item.kind === 'pen' || item.kind === 'highlight') {
    const xs = item.points.map((point) => point.x);
    const ys = item.points.map((point) => point.y);
    const x = Math.min(0, ...xs);
    const y = Math.min(0, ...ys);

    return {
      x: item.x + x,
      y: item.y + y,
      width: Math.max(0, ...xs) - x,
      height: Math.max(0, ...ys) - y,
    };
  }
  if (item.kind === 'text') {
    context.font = `${item.style.fontSize}px sans-serif`;
    width = Math.max(1, ...item.text.split('\n').map((line) => context.measureText(line).width));
    height = item.text.split('\n').length * item.style.fontSize * 1.2;
  }
  return {
    x: item.x + Math.min(0, width),
    y: item.y + Math.min(0, height),
    width: Math.abs(width),
    height: Math.abs(height),
  };
}

export function hitAnnotation(
  item: ImageAnnotation,
  point: ImagePoint,
  context: CanvasRenderingContext2D,
  tolerance: number,
) {
  const bounds = annotationBounds(item, context);
  return (
    point.x >= bounds.x - tolerance &&
    point.x <= bounds.x + bounds.width + tolerance &&
    point.y >= bounds.y - tolerance &&
    point.y <= bounds.y + bounds.height + tolerance
  );
}

export function drawAnnotation(context: CanvasRenderingContext2D, item: ImageAnnotation) {
  context.save();
  context.translate(item.x, item.y);
  context.strokeStyle = item.style.color;
  context.fillStyle = item.style.color;
  context.lineWidth = item.style.size;
  context.globalAlpha = item.style.opacity;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  switch (item.kind) {
    case 'rectangle':
      context.rect(0, 0, item.width, item.height);
      break;
    case 'circle':
      context.arc(item.width / 2, item.height / 2, Math.abs(item.width) / 2, 0, Math.PI * 2);
      break;
    case 'line':
      context.moveTo(0, 0);
      context.lineTo(item.width, item.height);
      break;
    case 'text':
      context.font = `${item.style.fontSize}px sans-serif`;
      context.textBaseline = 'top';
      item.text
        .split('\n')
        .forEach((line, index) => context.fillText(line, 0, index * item.style.fontSize * 1.2));
      context.restore();
      return;
    default:
      item.points.forEach((point, index) => {
        if (index === 0) {
          context.moveTo(point.x, point.y);
        } else {
          context.lineTo(point.x, point.y);
        }
      });
      if (item.points.length === 1) {
        const point = item.points[0]!;
        context.arc(point.x, point.y, item.style.size / 2, 0, Math.PI * 2);
        context.fill();
        context.restore();
        return;
      }
  }
  if (item.style.filled && ['rectangle', 'circle'].includes(item.kind)) {
    context.fill();
  }
  context.stroke();
  context.restore();
}

export function drawAnnotations(
  context: CanvasRenderingContext2D,
  items: readonly ImageAnnotation[],
  size: ImageSize,
  edits: ImageEdits,
) {
  const dimensions = annotationDimensions(size, edits);
  const origin = annotationPoint({ x: 0, y: 0 }, size, edits);
  const horizontal = annotationPoint({ x: 1, y: 0 }, size, edits);
  const vertical = annotationPoint({ x: 0, y: 1 }, size, edits);
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.save();
  context.scale(context.canvas.width / dimensions.width, context.canvas.height / dimensions.height);
  context.transform(
    horizontal.x - origin.x,
    horizontal.y - origin.y,
    vertical.x - origin.x,
    vertical.y - origin.y,
    origin.x,
    origin.y,
  );

  items.forEach((item) => drawAnnotation(context, item));
  context.restore();
}

export async function rasterizeAnnotations(
  items: readonly ImageAnnotation[],
  size: ImageSize,
  edits?: ImageEdits,
): Promise<Uint8Array | undefined> {
  if (!items.length) {
    return undefined;
  }
  const canvas = document.createElement('canvas');
  const dimensions = edits ? annotationDimensions(size, edits) : size;
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;

  try {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new ImageClientError('save_failed');
    }
    if (edits) {
      drawAnnotations(context, items, size, edits);
    } else {
      items.forEach((item) => drawAnnotation(context, item));
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new ImageClientError('save_failed'));
        }
      }, 'image/png');
    });

    if (blob.size > 30 * 1024 * 1024) {
      throw new ImageClientError('file_too_large');
    }

    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
