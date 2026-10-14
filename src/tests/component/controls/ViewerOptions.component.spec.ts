import ViewerOptions from '@/components/controls/ViewerOptions.vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n';
import { setTheme } from '@/composables/useTheme';

describe('ViewerOptions', () => {
  afterEach(() => {
    setLocale('it');
    setTheme('dark');
  });

  it('closes on Escape and emits open requests', async () => {
    const wrapper = mount(ViewerOptions);

    await wrapper.get('[data-testid="options_toggle"]').trigger('click');
    await wrapper.get('[data-testid="options_open"]').trigger('click');

    expect(wrapper.emitted('open')).toHaveLength(1);
    expect(wrapper.find('#viewer_options').exists()).toBe(false);

    await wrapper.get('[data-testid="options_toggle"]').trigger('click');
    await wrapper.trigger('keydown', { key: 'Escape' });

    expect(wrapper.find('#viewer_options').exists()).toBe(false);

    wrapper.unmount();
  });

  it('omits fullscreen and desktop-only settings in the browser menu', async () => {
    const wrapper = mount(ViewerOptions);

    await wrapper.get('[data-testid="options_toggle"]').trigger('click');

    for (const id of ['fullscreen_toggle', 'theme_light', 'theme_dark', 'locale_select']) {
      expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(false);
    }

    wrapper.unmount();
  });
});
