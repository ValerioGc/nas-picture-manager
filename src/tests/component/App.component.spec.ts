import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App.vue';
import { readyViewer } from '@tests/viewerStoreFixture';
import { imageDocument, imagePacket } from '@tests/fixtures';
import { pickNasFiles } from '@/services/nasShell';

vi.mock('@/services/nasShell', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/nasShell')>()),
  pickNasFiles: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(pickNasFiles).mockReset();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}

      disconnect() {}
    },
  );
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:image', revokeObjectURL: vi.fn() });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => imagePacket() }),
  );
});

afterEach(() => {
  window.history.replaceState({}, '', '/');
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('protects unsaved edits before replacing an image selected from the NAS', async () => {
    vi.stubGlobal('parent', {});
    const viewer = readyViewer();
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.get('[data-testid="edit_toggle"]').trigger('click');
    await wrapper.get('[data-testid="edit_modify"]').trigger('click');
    await wrapper.get('[data-testid="edit_brightness"]').setValue(20);
    vi.mocked(pickNasFiles).mockResolvedValueOnce({
      files: [
        {
          name: 'nas.png',
          path: '/photos/nas.png',
          url: '/apps/nas-file-manager/api/downloads?path=photos%2Fnas.png',
        },
      ],
      cancelled: false,
    });
    await wrapper.get('[data-testid="options_toggle"]').trigger('click');
    await wrapper.get('[data-testid="options_open"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="unsaved_dialog"]').attributes()).toHaveProperty('open');
    await wrapper.get('[data-testid="unsaved_cancel"]').trigger('click');
    await flushPromises();
    expect(viewer.unsaved).toBe(true);
    expect(fetch).not.toHaveBeenCalledWith(
      '/apps/nas-file-manager/api/downloads?path=photos%2Fnas.png',
      expect.anything(),
    );
    wrapper.unmount();
  });
  it('uses the NAS selector for buttons and shortcuts, preserving the image on cancellation and errors', async () => {
    vi.stubGlobal('parent', {});
    const viewer = readyViewer();
    const wrapper = mount(App);
    await flushPromises();
    const previous = wrapper.get('[data-testid="picture"]').attributes('src');
    expect(wrapper.find('[data-testid="file_input"]').exists()).toBe(false);
    vi.mocked(pickNasFiles).mockResolvedValueOnce({ files: [], cancelled: true });
    await wrapper.get('[data-testid="options_toggle"]').trigger('click');
    await wrapper.get('[data-testid="options_open"]').trigger('click');
    await flushPromises();
    expect(pickNasFiles).toHaveBeenCalledWith({
      multiple: true,
      extensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.ico'],
    });
    expect(wrapper.get('[data-testid="picture"]').attributes('src')).toBe(previous);
    vi.mocked(pickNasFiles).mockResolvedValueOnce({
      files: [],
      cancelled: false,
      error: 'Explorer unavailable',
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', ctrlKey: true }));
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('app File');
    expect(wrapper.get('[data-testid="picture"]').attributes('src')).toBe(previous);
    expect(viewer.imageReady).toBe(true);
    wrapper.unmount();
  });
  it('opens an Explorer image from its path in the Axum build', async () => {
    window.history.replaceState({}, '', '/?path=%2Fphotos%2Fsunset.png');
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['image'], { type: 'image/png' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => imagePacket(imageDocument('sunset.png')),
      } as Response);

    const wrapper = mount(App);
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith(
      '/apps/nas-file-manager/api/downloads?path=photos%2Fsunset.png',
    );
    expect(wrapper.get('[data-testid="file_name"]').text()).toBe('sunset.png');
    wrapper.unmount();
  });

  it('blocks editing and hides zoom without an image', async () => {
    const wrapper = mount(App);

    expect(wrapper.find('[data-testid="empty_state"]').exists()).toBe(true);
    expect(wrapper.findAll('header')).toHaveLength(1);
    expect(wrapper.find('[data-testid="viewer_toolbar"]').exists()).toBe(true);
    await wrapper.get('[data-testid="image_viewer"]').trigger('mousemove');

    expect(wrapper.find('aside').exists()).toBe(false);
    expect(wrapper.find('[data-testid="edit_toggle"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="info_toggle"]').exists()).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('aside').exists()).toBe(false);
    expect(wrapper.find('[data-testid="zoom_toggle"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('loads a file and shows its name and preview', async () => {
    const wrapper = mount(App);
    const input = wrapper.get('[data-testid="file_input"]');

    Object.defineProperty(input.element, 'files', { value: [new File(['test'], 'my-image.png')] });
    await input.trigger('change');
    await flushPromises();

    expect(wrapper.get('[data-testid="file_name"]').text()).toBe('my-image.png');
    expect(wrapper.get('[data-testid="picture"]').attributes('src')).toBe('blob:image');
    expect(wrapper.find('[data-testid="empty_state"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="zoom_toggle"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="edit_toggle"]').attributes()).not.toHaveProperty('disabled');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '2', ctrlKey: true }));
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="zoom_toggle"]').attributes('aria-label')).toContain('200');

    const pinch = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });

    expect(document.dispatchEvent(pinch)).toBe(false);
    expect(pinch.defaultPrevented).toBe(true);

    wrapper.unmount();
  });

  it('opens through shortcuts, handles drag-and-drop and keyboard navigation', async () => {
    const wrapper = mount(App);
    const input = wrapper.get('[data-testid="file_input"]');
    const click = vi.spyOn(input.element as HTMLInputElement, 'click');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', ctrlKey: true }));

    expect(click).toHaveBeenCalled();

    await wrapper.get('[data-testid="image_viewer"]').trigger('dragenter', {
      dataTransfer: { types: ['Files'] },
    });

    expect(wrapper.find('.drop_overlay').exists()).toBe(true);

    await wrapper.get('[data-testid="image_viewer"]').trigger('dragleave');

    expect(wrapper.find('.drop_overlay').exists()).toBe(false);

    await wrapper.get('[data-testid="image_viewer"]').trigger('dragenter', {
      dataTransfer: { types: [] },
    });

    expect(wrapper.find('.drop_overlay').exists()).toBe(false);

    await wrapper.get('[data-testid="image_viewer"]').trigger('drop', {
      dataTransfer: { files: [new File(['drop'], 'dropped.png')] },
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="file_name"]').text()).toBe('dropped.png');

    Object.defineProperty(input.element, 'files', {
      value: [new File(['first'], 'first.png'), new File(['second'], 'second.png')],
    });
    await input.trigger('change');
    await flushPromises();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await flushPromises();

    expect(wrapper.get('[data-testid="file_name"]').text()).toBe('second.png');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('aside').exists()).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('aside').exists()).toBe(false);

    wrapper.unmount();
  });

  it('shows load errors', async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'invalid_image' }),
    } as Response);

    const wrapper = mount(App);
    const input = wrapper.get('[data-testid="file_input"]');

    Object.defineProperty(input.element, 'files', { value: [new File(['bad'], 'bad.png')] });
    await input.trigger('change');
    await flushPromises();

    expect(wrapper.find('[data-testid="image_error"]').exists()).toBe(true);

    wrapper.unmount();
  });

  it('applies editor actions and protects unsaved changes', async () => {
    const wrapper = mount(App);
    const input = wrapper.get('[data-testid="file_input"]');

    Object.defineProperty(input.element, 'files', {
      value: [new File(['first'], 'first.png'), new File(['second'], 'second.png')],
    });
    await input.trigger('change');
    await flushPromises();
    await wrapper.get('[data-testid="edit_toggle"]').trigger('click');

    expect(wrapper.get('[data-testid="viewer_footer"]').classes()).toContain(
      'viewer_footer_hidden',
    );

    await wrapper.get('[data-testid="edit_modify"]').trigger('click');
    await wrapper.get('[data-testid="edit_brightness"]').setValue(20);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await flushPromises();

    expect(wrapper.get('[data-testid="file_name"]').text()).toBe('first.png');
    expect(wrapper.get('[data-testid="unsaved_dialog"]').attributes()).toHaveProperty('open');
    await wrapper.get('[data-testid="unsaved_cancel"]').trigger('click');
    await flushPromises();

    const unload = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;

    window.dispatchEvent(unload);

    expect(unload.defaultPrevented).toBe(true);

    await wrapper.get('[data-testid="edit_reset"]').trigger('click');
    wrapper.unmount();
  });

  it('keeps the current image when replacement is cancelled and closes panels from their button', async () => {
    const wrapper = mount(App);
    const input = wrapper.get('[data-testid="file_input"]');

    Object.defineProperty(input.element, 'files', {
      value: [new File(['first'], 'first.png')],
      configurable: true,
    });
    await input.trigger('change');
    await flushPromises();
    await wrapper.get('[data-testid="edit_toggle"]').trigger('click');
    await wrapper.get('[data-testid="edit_modify"]').trigger('click');
    await wrapper.get('[data-testid="edit_brightness"]').setValue(20);

    Object.defineProperty(input.element, 'files', {
      value: [new File(['replacement'], 'replacement.png')],
      configurable: true,
    });
    await input.trigger('change');
    await flushPromises();

    expect(wrapper.get('[data-testid="unsaved_dialog"]').attributes()).toHaveProperty('open');
    await wrapper.get('[data-testid="unsaved_cancel"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="file_name"]').text()).toBe('first.png');

    await wrapper.get('[data-testid="panel_close"]').trigger('click');
    expect(wrapper.get('[data-testid="unsaved_dialog"]').attributes()).toHaveProperty('open');
    await wrapper.get('[data-testid="unsaved_discard"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('aside').exists()).toBe(false);
    wrapper.unmount();
  });

  it('cancels rendering when modifications are discarded and restores the source preview', async () => {
    const wrapper = mount(App);
    const input = wrapper.get('[data-testid="file_input"]');
    Object.defineProperty(input.element, 'files', { value: [new File(['image'], 'image.png')] });
    await input.trigger('change');
    await flushPromises();
    const original = wrapper.get('[data-testid="picture"]').attributes('src');
    await wrapper.get('[data-testid="edit_toggle"]').trigger('click');
    await wrapper.get('[data-testid="edit_modify"]').trigger('click');
    await wrapper.get('[data-testid="edit_brightness"]').setValue(20);
    expect(wrapper.find('[data-testid="edit_processing"]').exists()).toBe(true);
    await wrapper.get('[data-testid="panel_close"]').trigger('click');
    await wrapper.get('[data-testid="unsaved_discard"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="picture"]').attributes('src')).toBe(original);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="image_sidebar"]').exists()).toBe(false);
    wrapper.unmount();
  });
  it.each([
    { action: 'close button', selector: 'panel_close', key: '', target: null },
    { action: 'edit button', selector: 'edit_toggle', key: '', target: null },
    { action: 'details button', selector: 'info_toggle', key: '', target: 'Dettagli immagine' },
    { action: 'Escape', selector: '', key: 'Escape', target: null },
    { action: 'edit shortcut', selector: '', key: 'e', target: null },
    { action: 'details shortcut', selector: '', key: 'i', target: 'Dettagli immagine' },
  ])('confirms leaving unsaved edits through $action', async ({ selector, key, target }) => {
    const viewer = readyViewer();
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.get('[data-testid="edit_toggle"]').trigger('click');
    await wrapper.get('[data-testid="edit_modify"]').trigger('click');
    await wrapper.get('[data-testid="edit_brightness"]').setValue(20);
    const leave = async () => {
      if (key) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key }));
        await wrapper.vm.$nextTick();
      } else {
        await wrapper.get(`[data-testid="${selector}"]`).trigger('click');
      }
    };
    await leave();
    expect(wrapper.get('[data-testid="unsaved_dialog"]').attributes()).toHaveProperty('open');
    expect(wrapper.get('[data-testid="image_sidebar"]').attributes('aria-label')).toBe(
      'Modifica immagine',
    );
    expect(wrapper.get('[data-testid="unsaved_discard"]').text()).toBe('Annulla modifiche');
    await wrapper.get('[data-testid="unsaved_cancel"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-testid="edit_brightness"]').element).toHaveProperty('value', '20');
    await leave();
    await wrapper.get('[data-testid="unsaved_discard"]').trigger('click');
    await flushPromises();
    if (target) {
      expect(wrapper.get('[data-testid="image_sidebar"]').attributes('aria-label')).toBe(target);
    } else {
      expect(wrapper.find('[data-testid="image_sidebar"]').exists()).toBe(false);
    }
    expect(viewer.edits.brightness).toBe(0);
    expect(viewer.unsaved).toBe(false);
    wrapper.unmount();
  });
  it('navigates selected files with arrow keys and navigation buttons', async () => {
    const wrapper = mount(App);
    const input = wrapper.get('[data-testid="file_input"]');
    Object.defineProperty(input.element, 'files', {
      value: ['a.png', 'b.png', 'c.png'].map((name) => new File(['image'], name)),
    });
    await input.trigger('change');
    await flushPromises();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await flushPromises();
    expect(wrapper.get('[data-testid="picture"]').attributes('alt')).toBe('b.png');
    expect(wrapper.get('[data-testid="next_image"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.get('[data-testid="previous_image"]').attributes('disabled')).toBeUndefined();
    await wrapper.get('[data-testid="edit_toggle"]').trigger('click');
    await wrapper.get('[data-testid="edit_modify"]').trigger('click');
    await wrapper.get('[data-testid="edit_brightness"]').setValue(20);
    await wrapper.get('[data-testid="panel_close"]').trigger('click');
    await wrapper.get('[data-testid="unsaved_discard"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="unsaved_dialog"]').exists()).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await flushPromises();
    expect(wrapper.get('[data-testid="picture"]').attributes('alt')).toBe('c.png');
    expect(wrapper.get('[data-testid="next_image"]').attributes()).toHaveProperty('disabled');
    await wrapper.get('[data-testid="previous_image"]').trigger('click');
    await flushPromises();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await flushPromises();
    expect(wrapper.get('[data-testid="picture"]').attributes('alt')).toBe('a.png');
    expect(wrapper.get('[data-testid="previous_image"]').attributes()).toHaveProperty('disabled');
    wrapper.unmount();
  });
});
