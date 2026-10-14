import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultEdits, useImageEditor } from '@/composables/useImageEditor';
import type { ImageEntry, ImageInfo } from '@/types/types';
import { annotation } from '@tests/canvasFixture';
import { imageDocument } from '@tests/fixtures';

const { renderImage, saveImage, rasterizeAnnotations } = vi.hoisted(() => ({
  renderImage: vi.fn(),
  saveImage: vi.fn(),
  rasterizeAnnotations: vi.fn(),
}));

vi.mock('@/services/annotations', () => ({ rasterizeAnnotations }));

vi.mock('@/composables/imageClient', () => ({
  renderImage,
  saveImage,
  imageError: () => 'unavailable',
}));

let editor: ReturnType<typeof useImageEditor>;
let wrapper: ReturnType<typeof mount>;
const entry = ref<ImageEntry>({ id: 0, name: 'a.png' });
const info = ref<ImageInfo | null>(imageDocument().info);

beforeEach(() => {
  vi.useFakeTimers();
  entry.value = { id: 0, name: 'a.png' };
  info.value = imageDocument().info;
  renderImage.mockResolvedValue(imageDocument());
  rasterizeAnnotations.mockReset();
  rasterizeAnnotations.mockResolvedValue(undefined);
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:edited'), revokeObjectURL: vi.fn() });
  wrapper = mount({
    setup() {
      editor = useImageEditor(entry, info);

      return () => null;
    },
  });
});

afterEach(() => {
  wrapper.unmount();
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('useImageEditor', () => {
  it.each([
    ['PNG', 'png'],
    ['JPG', 'jpeg'],
    ['JPEG', 'jpeg'],
    ['WebP', 'webp'],
    ['GIF', 'original'],
    ['BMP', 'original'],
    ['TIFF', 'original'],
    ['TIF', 'original'],
    ['ICO', 'original'],
  ])('defaults to the %s source format using %s', (sourceFormat, expected) => {
    editor.format.value = 'webp';
    info.value = { ...imageDocument().info, format: sourceFormat };
    expect(editor.format.value).toBe(expected);
  });

  it.each([
    ['PNG', 'png'],
    ['JPG', 'jpeg'],
    ['JPEG', 'jpeg'],
    ['WEBP', 'webp'],
    ['GIF', 'gif'],
    ['BMP', 'bmp'],
    ['TIFF', 'tiff'],
    ['TIF', 'tiff'],
    ['ICO', 'ico'],
  ])('resolves Original using %s content and exports as %s', async (sourceFormat, expected) => {
    info.value = { ...imageDocument().info, format: sourceFormat };
    editor.format.value = 'webp';
    editor.format.value = 'original';
    saveImage.mockResolvedValue('a_edited');
    await editor.save();
    expect(saveImage).toHaveBeenCalledWith(entry.value, expect.any(Object), expected);
    expect(editor.format.value).toBe('original');
  });

  it('exports annotations in the original source format', async () => {
    info.value = { ...imageDocument().info, format: 'JPEG' };
    editor.format.value = 'original';
    editor.beginAnnotation();
    editor.addAnnotation(annotation());
    editor.finishAnnotation();
    const overlay = new Uint8Array([1, 2, 3]);
    rasterizeAnnotations.mockResolvedValue(overlay);
    saveImage.mockResolvedValue('a_edited.jpg');
    await editor.save();
    expect(saveImage).toHaveBeenCalledWith(entry.value, expect.any(Object), 'jpeg', overlay);
  });

  it('uses the original format when the editor starts with an image already loaded', () => {
    wrapper.unmount();
    info.value = { ...imageDocument().info, format: 'JPEG' };
    wrapper = mount({
      setup() {
        editor = useImageEditor(entry, info);
        return () => null;
      },
    });
    expect(editor.format.value).toBe('jpeg');
  });

  it('preserves a manual format during edits and reset, and saves with that format', async () => {
    info.value = { ...imageDocument().info, format: 'JPEG' };
    editor.format.value = 'webp';
    editor.edits.value.rotation = 1;
    await vi.advanceTimersByTimeAsync(180);
    expect(editor.format.value).toBe('webp');
    editor.reset();
    expect(editor.format.value).toBe('webp');
    saveImage.mockResolvedValue('a_edited.webp');
    await editor.save();
    expect(saveImage).toHaveBeenCalledWith(entry.value, expect.any(Object), 'webp');
  });

  it('updates the default for each new image, even when the source format is unchanged', () => {
    info.value = { ...imageDocument().info, format: 'JPEG' };
    editor.format.value = 'webp';
    entry.value = { id: 1, name: 'b.jpg' };
    info.value = { ...imageDocument('b.jpg').info, format: 'JPEG' };
    expect(editor.format.value).toBe('jpeg');
    info.value = null;
    expect(editor.format.value).toBe('png');
    entry.value = { id: 2, name: 'c.webp' };
    info.value = { ...imageDocument('c.webp').info, format: 'WEBP' };
    expect(editor.format.value).toBe('webp');
  });

  it('debounces adjustments and ignores stale renders after reset', async () => {
    let complete: (value: ReturnType<typeof imageDocument>) => void = () => {};

    renderImage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    editor.edits.value.brightness = 10;
    editor.edits.value.brightness = 30;
    await vi.advanceTimersByTimeAsync(180);

    expect(renderImage).toHaveBeenCalledTimes(1);
    expect(renderImage.mock.calls[0]?.[1]).toMatchObject({ brightness: 30 });

    editor.reset();
    complete(imageDocument());
    await flushPromises();

    expect(editor.preview.value).toBe('');
    expect(editor.processing.value).toBe(false);
  });

  it('preserves unsaved changes when export is cancelled, and supports retry', async () => {
    editor.edits.value.rotation = 1;
    await vi.advanceTimersByTimeAsync(180);
    saveImage
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce('save_failed')
      .mockResolvedValueOnce('a_edited.png');
    await editor.save();

    expect(editor.unsaved.value).toBe(true);

    await editor.save();

    expect(editor.error.value).toBe('unavailable');

    await editor.save();

    expect(editor.unsaved.value).toBe(false);
    expect(editor.savedName.value).toBe('a_edited.png');
  });

  it('saves annotations from a stable snapshot and updates the unsaved state', async () => {
    editor.beginAnnotation();
    editor.addAnnotation(annotation());
    editor.finishAnnotation();
    expect(editor.unsaved.value).toBe(true);
    expect(editor.dirty.value).toBe(true);
    expect(renderImage).not.toHaveBeenCalled();
    const overlay = new Uint8Array([1, 2, 3]);
    rasterizeAnnotations.mockResolvedValue(overlay);
    saveImage.mockResolvedValue('annotated.png');
    await editor.save();
    expect(saveImage).toHaveBeenCalledWith(entry.value, expect.any(Object), 'png', overlay);
    expect(rasterizeAnnotations).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ kind: 'rectangle' })]),
      { width: 640, height: 480 },
      defaultEdits(),
    );
    expect(editor.unsaved.value).toBe(false);
    editor.setAnnotationStyle({ size: 10 });
    expect(editor.unsaved.value).toBe(true);
    expect(editor.savedName.value).toBe('');
    editor.undoAnnotation();
    expect(editor.unsaved.value).toBe(false);
    editor.startCrop();
    expect(editor.annotationTool.value).toBeNull();
    editor.reset();
    expect(editor.annotations.value).toEqual([]);
  });

  it('blocks saving an unfinished gesture and preserves annotations after an encoding error', async () => {
    editor.beginAnnotation();
    editor.addAnnotation(annotation());
    await editor.save();
    expect(rasterizeAnnotations).not.toHaveBeenCalled();
    editor.finishAnnotation();
    rasterizeAnnotations.mockRejectedValue(new Error('save_failed'));
    await editor.save();
    expect(editor.error.value).toBe('unavailable');
    expect(editor.annotations.value).toHaveLength(1);
    expect(editor.unsaved.value).toBe(true);
    expect(editor.saving.value).toBe(false);
  });

  it('applies only valid crops in rotated coordinates', async () => {
    editor.edits.value.rotation = 1;
    await vi.advanceTimersByTimeAsync(180);
    editor.startCrop();

    expect(editor.dimensions.value).toEqual({ width: 480, height: 640 });

    editor.crop.value = { x: 470, y: 0, width: 20, height: 10 };

    expect(editor.validCrop.value).toBe(false);

    editor.applyCrop();

    expect(editor.edits.value.crop).toBeNull();

    editor.setRatio('1:1');
    editor.applyCrop();

    expect(editor.edits.value.crop).toEqual({ x: 0, y: 80, width: 480, height: 480 });
  });
});
