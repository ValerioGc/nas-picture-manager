import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ViewerToolbar from '@/components/layout/ViewerToolbar.vue';
import { useGlobalStore } from '@/stores/globalStore';
import { readyViewer } from '@tests/viewerStoreFixture';

describe('ViewerToolbar', () => {
  it('shows the filename and toggles the shared panel', async () => {
    readyViewer('foto.png');
    const global = useGlobalStore();
    const wrapper = mount(ViewerToolbar);

    expect(wrapper.get('[data-testid="file_name"]').text()).toBe('foto.png');
    await wrapper.get('[data-testid="info_toggle"]').trigger('click');
    expect(global.panel).toBe('info');
    await wrapper.get('[data-testid="edit_toggle"]').trigger('click');
    expect(global.panel).toBe('edit');

    global.hide_chrome();
    await wrapper.vm.$nextTick();
    expect(wrapper.classes()).toContain('viewer_toolbar_hidden');
    wrapper.unmount();
  });

  it('shows the open action without duplicating the app title before an image is selected', async () => {
    const wrapper = mount(ViewerToolbar);
    expect(wrapper.text()).not.toContain('Picture Manager');
    expect(wrapper.find('[data-testid="info_toggle"]').exists()).toBe(false);
    await wrapper.get('[data-testid="options_toggle"]').trigger('click');
    await wrapper.get('[data-testid="options_open"]').trigger('click');
    expect(wrapper.emitted('open')).toHaveLength(1);
    wrapper.unmount();
  });
});
