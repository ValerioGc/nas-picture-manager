import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  annotationBounds,
  annotationDimensions,
  annotationPoint,
  drawAnnotation,
  drawAnnotations,
  hitAnnotation,
  rasterizeAnnotations,
} from '@/services/annotations';
import { defaultEdits } from '@/composables/useImageEditor';
import { annotation, canvasContext } from '@tests/canvasFixture';

const size = { width: 640, height: 480 };
afterEach(() => vi.restoreAllMocks());

describe('annotation rendering', () => {
  it('maps source coordinates through every rotation, flip and crop and back', () => {
    for (let rotation = 0; rotation < 4; rotation++) {
      for (const flipHorizontal of [false, true]) {
        for (const flipVertical of [false, true]) {
          for (const crop of [null, { x: 10, y: 20, width: 50, height: 60 }]) {
            const edits = { ...defaultEdits(), rotation, flipHorizontal, flipVertical, crop };
            const point = { x: 55, y: 71 };
            expect(annotationPoint(annotationPoint(point, size, edits), size, edits, true)).toEqual(
              point,
            );
            expect(annotationDimensions(size, edits)).toEqual(
              crop ?? (rotation % 2 ? { width: 480, height: 640 } : size),
            );
          }
        }
      }
    }
    expect(annotationPoint({ x: 10, y: 20 }, size, { ...defaultEdits(), rotation: 1 })).toEqual({
      x: 460,
      y: 10,
    });
  });

  it('draws shapes with their style and computes negative-direction bounds', () => {
    const context = canvasContext();
    drawAnnotation(context, annotation({ style: { ...annotation().style, filled: true } }));
    expect(context.rect).toHaveBeenCalledWith(0, 0, 30, 40);
    expect(context.fill).toHaveBeenCalledOnce();
    expect(context.stroke).toHaveBeenCalledOnce();
    expect(context.strokeStyle).toBe('#ff0000');
    drawAnnotation(context, annotation({ kind: 'circle', width: 20, height: 20 }));
    expect(context.arc).toHaveBeenCalledWith(10, 10, 10, 0, Math.PI * 2);
    drawAnnotation(context, annotation({ kind: 'line', width: -30, height: -40 }));
    expect(context.lineTo).toHaveBeenCalledWith(-30, -40);
    expect(annotationBounds(annotation({ width: -30, height: -40 }), context)).toEqual({
      x: -20,
      y: -20,
      width: 30,
      height: 40,
    });
    expect(hitAnnotation(annotation(), { x: 20, y: 30 }, context, 2)).toBe(true);
    expect(hitAnnotation(annotation(), { x: 100, y: 100 }, context, 2)).toBe(false);
  });

  it('draws multiline text and brush strokes with opacity applied once per stroke', () => {
    const context = canvasContext();
    const text = annotation({ kind: 'text', text: 'Hi\nNote' });
    drawAnnotation(context, text);
    expect(context.fillText).toHaveBeenCalledWith('Hi', 0, 0);
    expect(context.fillText).toHaveBeenCalledWith('Note', 0, 28.799999999999997);
    expect(annotationBounds(text, context)).toEqual({
      x: 10,
      y: 20,
      width: 48,
      height: 57.599999999999994,
    });
    const stroke = annotation({
      kind: 'highlight',
      points: [
        { x: 0, y: 0 },
        { x: -10, y: -5 },
        { x: 20, y: 10 },
      ],
      style: { ...annotation().style, opacity: 0.35 },
    });
    drawAnnotation(context, stroke);
    expect(context.globalAlpha).toBe(0.35);
    expect(context.stroke).toHaveBeenCalledOnce();
    expect(annotationBounds(stroke, context)).toEqual({ x: 0, y: 15, width: 30, height: 15 });
    drawAnnotation(context, annotation({ kind: 'pen', points: [{ x: 2, y: 3 }] }));
    expect(context.arc).toHaveBeenCalledWith(2, 3, 2, 0, Math.PI * 2);
    drawAnnotations(context, [annotation()], size, { ...defaultEdits(), rotation: 1 });
    expect(context.transform).toHaveBeenCalledWith(0, 1, -1, 0, 480, 0);
    expect(context.restore).toHaveBeenCalled();
  });

  it('exports a full-size transparent PNG and releases the temporary canvas', async () => {
    const context = canvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const png = new Blob(['PNG'], { type: 'image/png' });
    Object.defineProperty(png, 'arrayBuffer', {
      value: async () => new TextEncoder().encode('PNG').buffer,
    });
    let dimensions: number[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback,
    ) {
      dimensions = [this.width, this.height];
      callback(png);
    });
    expect(await rasterizeAnnotations([], size)).toBeUndefined();
    expect(Array.from((await rasterizeAnnotations([annotation()], size))!)).toEqual([80, 78, 71]);
    expect(dimensions).toEqual([640, 480]);
  });

  it('reports unavailable contexts, failed encoding and oversized overlays', async () => {
    const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(rasterizeAnnotations([annotation()], size)).rejects.toMatchObject({
      code: 'save_failed',
    });
    context.mockReturnValue(canvasContext());
    const encode = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((callback) => callback(null));
    await expect(rasterizeAnnotations([annotation()], size)).rejects.toMatchObject({
      code: 'save_failed',
    });
    const blob = new Blob();
    Object.defineProperty(blob, 'size', { value: 31 * 1024 * 1024 });
    encode.mockImplementation((callback) => callback(blob));
    await expect(rasterizeAnnotations([annotation()], size)).rejects.toMatchObject({
      code: 'file_too_large',
    });
  });

  it('allocates only the cropped output canvas and transforms original annotation coordinates', async () => {
    const context = canvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const blob = new Blob(['PNG']);
    Object.defineProperty(blob, 'arrayBuffer', { value: async () => new ArrayBuffer(3) });
    let dimensions: number[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback,
    ) {
      dimensions = [this.width, this.height];
      callback(blob);
    });
    await rasterizeAnnotations(
      [annotation()],
      { width: 10000, height: 10000 },
      { ...defaultEdits(), rotation: 1, crop: { x: 10, y: 20, width: 100, height: 200 } },
    );
    expect(dimensions).toEqual([100, 200]);
    expect(context.transform).toHaveBeenCalledWith(0, 1, -1, 0, 9990, -20);
  });
});
