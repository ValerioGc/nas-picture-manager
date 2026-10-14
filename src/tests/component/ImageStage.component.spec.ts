import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ImageStage from '@/components/ImageStage.vue';
import { useViewerStore } from '@/stores/viewerStore';
import { readyViewer } from '@tests/viewerStoreFixture';
import { setLocale } from '@/i18n';

beforeEach(() =>
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  ),
);

afterEach(() => vi.unstubAllGlobals());

describe('ImageStage', () => {
  it.each([
    ['file_too_large', 'Limite di peso del file superato (massimo 30 MiB).'],
    [
      'pixel_limit_exceeded',
      'Limite di dimensione dell’immagine superato (massimo 100 megapixel).',
    ],
    [
      'dimension_limit_exceeded',
      'Limite di lunghezza del lato dell’immagine superato (massimo 16.384 pixel).',
    ],
    ['decode_memory_limit_exceeded', 'Limite di memoria per aprire l’immagine superato.'],
    ['too_many_files', 'Limite di numero di file superato (massimo 500 immagini).'],
  ] as const)('shows only the cause for %s', (code, message) => {
    setLocale('it');
    const viewer = useViewerStore();
    viewer.error = code;
    const wrapper = mount(ImageStage);
    expect(wrapper.get('[data-testid="image_error"] p').text()).toBe(message);
    wrapper.unmount();
  });

  it('shows loading and a recoverable error before displaying an image', async () => {
    const viewer = useViewerStore();
    const wrapper = mount(ImageStage);

    expect(wrapper.find('[data-testid="empty_state"]').exists()).toBe(true);
    await wrapper.get('[data-testid="open_images"]').trigger('click');
    expect(wrapper.emitted('open')).toHaveLength(1);

    viewer.loading = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('output').exists()).toBe(true);

    viewer.loading = false;
    viewer.error = 'invalid_image';
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="image_error"]').exists()).toBe(true);
    await wrapper.get('[data-testid="image_error"] button').trigger('click');
    expect(wrapper.emitted('open')).toHaveLength(2);

    readyViewer();
    viewer.error = null;
    viewer.zoom = 200;
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="picture"]').attributes('style')).toContain('width: 1280px');

    viewer.processing = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.loading_overlay').exists()).toBe(true);
    wrapper.unmount();
  });

  it('limits gesture zoom during cropping', async () => {
    const viewer = readyViewer();
    viewer.zoom = 400;
    viewer.cropping = true;
    const wrapper = mount(ImageStage);

    expect(wrapper.find('[data-testid="crop_surface"]').exists()).toBe(true);
    const viewport = wrapper.get('[data-testid="image_viewport"]').element;
    viewport.dispatchEvent(
      new WheelEvent('wheel', { cancelable: true, ctrlKey: true, deltaY: -1 }),
    );
    expect(viewer.zoom).toBe(400);

    viewer.zoom = 10;
    viewport.dispatchEvent(new WheelEvent('wheel', { cancelable: true, ctrlKey: true, deltaY: 1 }));
    expect(viewer.zoom).toBe(10);

    viewer.cropping = false;
    wrapper.unmount();
  });
});
