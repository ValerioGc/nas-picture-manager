import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useImageViewer } from '@/composables/useImageViewer';
import { imageDocument, imagePacket } from '@tests/fixtures';

const fetchMock = vi.fn();
let viewer: ReturnType<typeof useImageViewer>;
let wrapper: ReturnType<typeof mount>;

function response(name = 'photo.png') {
  return { ok: true, arrayBuffer: async () => imagePacket(imageDocument(name)) };
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() });
  wrapper = mount({
    setup() {
      viewer = useImageViewer();

      return () => null;
    },
  });
});

afterEach(() => {
  wrapper.unmount();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useImageViewer', () => {
  it('loads NAS images lazily and reuses their bytes when navigating back', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['first']) })
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['second']) })
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response());
    const files = ['first', 'second'].map((name) => ({
      name: `${name}.png`,
      path: `/photos/${name}.png`,
      url: `/apps/nas-file-manager/api/downloads?path=${name}.png`,
    }));
    await viewer.selectFiles(files);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      files[0]?.url,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(viewer.info.value?.folder).toBe('/photos');
    expect(viewer.info.value?.modified).toBeNull();
    viewer.navigate(1);
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(viewer.info.value?.name).toBe('second.png');
    viewer.navigate(-1);
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(viewer.info.value?.name).toBe('first.png');
  });

  it('reports unavailable and oversized NAS sources before uploading them to Axum', async () => {
    const source = {
      name: 'photo.png',
      path: '/photo.png',
      url: '/apps/nas-file-manager/api/downloads?path=photo.png',
    };
    fetchMock.mockResolvedValueOnce({ ok: false });
    await viewer.selectFiles([source]);
    expect(viewer.error.value).toBe('unavailable');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob([new Uint8Array(30 * 1024 * 1024 + 1)]),
    });
    await viewer.selectFiles([source]);
    expect(viewer.error.value).toBe('file_too_large');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('loads file bytes through Axum and releases old previews', async () => {
    fetchMock.mockResolvedValue(response());

    const file = new File(['bytes'], 'chosen.png', { lastModified: 1000 });

    await viewer.selectFiles([file, new File(['next'], 'next.png')]);

    expect(fetchMock).toHaveBeenCalledWith(
      'api/images/inspect',
      expect.objectContaining({ body: file, method: 'POST' }),
    );
    expect(viewer.info.value?.name).toBe('chosen.png');

    viewer.navigate(1);
    await flushPromises();

    expect(viewer.index.value).toBe(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');

    viewer.navigate(1);

    expect(viewer.index.value).toBe(1);
  });

  it('ignores stale responses after navigation', async () => {
    let resolveFirst: (value: ReturnType<typeof response>) => void = () => {};

    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(response('new.png'));

    const pending = viewer.selectFiles([new File(['a'], 'old.png'), new File(['b'], 'new.png')]);

    await flushPromises();
    viewer.navigate(1);
    await flushPromises();
    resolveFirst(response('old.png'));
    await pending;
    await flushPromises();

    expect(viewer.info.value?.name).toBe('new.png');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('reports typed errors and leaves no stale image', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'invalid_image' }) });
    await viewer.selectFiles([new File(['bad'], 'bad.png')]);

    expect(viewer.error.value).toBe('invalid_image');
    expect(viewer.preview.value).toBe('');
  });

  it('rejects excessive selections before loading files', async () => {
    await viewer.selectFiles([]);

    expect(fetchMock).not.toHaveBeenCalled();

    await viewer.selectFiles(Array.from({ length: 501 }, (_, id) => new File(['x'], `${id}.png`)));

    expect(viewer.error.value).toBe('too_many_files');
    expect(viewer.entries.value).toEqual([]);
  });

  it('rejects oversized uploads before sending a request', async () => {
    const large = new File([new Uint8Array(30 * 1024 * 1024 + 1)], 'large.png');
    await viewer.selectFiles([large]);
    expect(viewer.error.value).toBe('file_too_large');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
