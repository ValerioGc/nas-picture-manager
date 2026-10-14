import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { setTheme, useTheme } from '@/composables/useTheme';

function mountTheme() {
  const component = defineComponent({
    setup: () => useTheme(),
    template: '<span>{{ theme }}</span>',
  });

  return mount(component);
}

describe('useTheme', () => {
  beforeEach(() => {
    setTheme('dark');
  });

  it('applies the current theme to the document', () => {
    const wrapper = mountTheme();

    expect(wrapper.text()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('applies updates to the light and dark themes', async () => {
    const wrapper = mountTheme();

    wrapper.vm.setTheme('light');
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');

    wrapper.vm.setTheme('dark');
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
});
