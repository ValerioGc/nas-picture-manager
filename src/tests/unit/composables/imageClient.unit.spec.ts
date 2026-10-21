import { exportName } from '@/services/httpImages';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { imageError, ImageClientError, renderImage, saveImage } from '@/composables/imageClient';
import type { ImageEdits, ImageEntry } from '@/types/types';
import { imageDocument, imagePacket } from '@tests/fixtures';

const edits: ImageEdits = {
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false,
  brightness: 0,
  contrast: 0,
  sharpness: 0,
  crop: null,
};

function upload(name = 'photo.png'): ImageEntry {
  return { id: 1, name, file: new File(['pixels'], name) };
}

describe('imageClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:download'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('normalizes typed image errors', async () => {
    expect(imageError(new ImageClientError('invalid_image'))).toBe('invalid_image');
    for (const code of [
      'file_too_large',
      'pixel_limit_exceeded',
      'dimension_limit_exceeded',
      'decode_memory_limit_exceeded',
      'too_many_files',
    ] as const) {
      expect(imageError(code)).toBe(code);
      expect(imageError(new ImageClientError(code))).toBe(code);
    }
    expect(imageError(new Error('unexpected'))).toBe('unavailable');
  });

  it('renders in the browser and returns typed transport errors', async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => imagePacket(),
    } as Response);

    await expect(renderImage(upload(), edits)).resolves.toEqual({
      ...imageDocument(),
      preview: new Uint8Array(imageDocument().preview),
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('api/images/render?'),
      expect.objectContaining({ method: 'POST' }),
    );

    for (const code of ['invalid_edits', 'pixel_limit_exceeded', 'decode_memory_limit_exceeded']) {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: code }),
      } as Response);
      await expect(renderImage(upload(), edits)).rejects.toMatchObject({ code });
    }
  });

  it('downloads exports in the browser', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(['image']),
    } as Response);

    expect(await saveImage(upload('folder.photo.png'), edits, 'jpeg')).toBe(
      'folder.photo_edited.jpg',
    );
    expect(exportName('photo', 'webp')).toBe('photo_edited.webp');
    expect(click).toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:download');

    click.mockRestore();
  });
});

describe('annotated image exports', () => {
  it('transmits the original binary and PNG overlay in HTTP', async () => {
    const overlay = new Uint8Array([1, 2, 3]);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue({ ok: true, blob: async () => new Blob(['image']) } as Response);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:copy'), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await saveImage(upload(), edits, 'png', overlay);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('api/images/export_overlay?'),
      expect.objectContaining({ body: expect.any(Blob) }),
    );
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = options?.body as Blob;
    const bytes = new Uint8Array(await body.arrayBuffer());
    expect(new DataView(bytes.buffer).getUint32(0, true)).toBe(6);
    expect(Array.from(bytes.slice(4, 10))).toEqual([112, 105, 120, 101, 108, 115]);
    expect(Array.from(bytes.slice(10))).toEqual([1, 2, 3]);
    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
