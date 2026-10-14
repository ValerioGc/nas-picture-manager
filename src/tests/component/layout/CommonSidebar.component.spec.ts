import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import CommonSidebar from '@/components/layout/CommonSidebar.vue';
import { useGlobalStore } from '@/stores/globalStore';
import { readyViewer } from '@tests/viewerStoreFixture';

describe('CommonSidebar', () => {
  it('shows image details from the viewer store', () => {
    readyViewer();
    useGlobalStore().panel = 'info';
    const wrapper = mount(CommonSidebar);
    expect(wrapper.text()).toContain('640 × 480');
    expect(wrapper.text()).toContain('photo.png');
    expect(wrapper.text()).toContain('Non disponibile');
    wrapper.unmount();
  });

  it('switches between the panels and closes on request', async () => {
    const global = useGlobalStore();
    global.panel = 'edit';
    const wrapper = mount(CommonSidebar);
    expect(wrapper.find('[data-testid="edit_notice"]').exists()).toBe(true);
    global.panel = 'info';
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Nessuna immagine aperta');
    await wrapper.get('[data-testid="panel_close"]').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
    wrapper.unmount();
  });

  it('shows browser and static-image hints', () => {
    const viewer = readyViewer();
    viewer.info = { ...viewer.info!, format: 'GIF', hasAlpha: false };
    useGlobalStore().panel = 'info';
    const wrapper = mount(CommonSidebar);
    expect(wrapper.text()).toContain('Il browser non fornisce');
    expect(wrapper.text()).toContain('Anteprima statica');
    expect(wrapper.text()).toContain('No');
    wrapper.unmount();
  });
});
