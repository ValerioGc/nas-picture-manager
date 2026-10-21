import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import ViewerFooter from '@/components/layout/ViewerFooter.vue';
import { useGlobalStore } from '@/stores/globalStore';
import { useViewerStore } from '@/stores/viewerStore';
import { readyViewer } from '@tests/viewerStoreFixture';

describe('ViewerFooter', () => {
  it('navigates within the selection and blocks navigation during saving', async () => {
    const viewer = readyViewer();
    viewer.entries = [
      { id: 0, name: 'first.png' },
      { id: 1, name: 'second.png' },
    ];
    const navigate = vi.spyOn(viewer, 'navigate').mockImplementation(async (direction) => {
      viewer.index += direction;
    });
    const wrapper = mount(ViewerFooter);

    expect(wrapper.get('[data-testid="previous_image"]').attributes()).toHaveProperty('disabled');
    await wrapper.get('[data-testid="next_image"]').trigger('click');
    expect(navigate).toHaveBeenCalledWith(1);
    await wrapper.get('[data-testid="previous_image"]').trigger('click');
    expect(navigate).toHaveBeenCalledWith(-1);

    await wrapper.get('[data-testid="zoom_toggle"]').trigger('click');
    await wrapper.get('[data-testid="zoom_100"]').trigger('click');
    expect(viewer.zoom).toBe(100);

    viewer.saving = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="next_image"]').attributes()).toHaveProperty('disabled');
    wrapper.unmount();
  });

  it('hides controls without metadata and when the chrome closes', () => {
    const viewer = useViewerStore();
    const global = useGlobalStore();
    global.hide_chrome();
    const wrapper = mount(ViewerFooter);
    expect(wrapper.find('[data-testid="zoom_toggle"]').exists()).toBe(false);
    expect(wrapper.find('.image_summary').exists()).toBe(false);
    expect(wrapper.classes()).toContain('viewer_footer_hidden');
    viewer.entries = [{ id: 0, name: 'only.png' }];
    expect(wrapper.get('[data-testid="next_image"]').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });
});
