import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ZoomControl from '@/components/controls/ZoomControl.vue';

describe('ZoomControl', () => {
  it('selects presets and closes its dropdown', async () => {
    const wrapper = mount(ZoomControl, { props: { modelValue: 'fit' } });

    await wrapper.get('[data-testid="zoom_toggle"]').trigger('click');
    await wrapper.get('[data-testid="zoom_200"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([[200]]);
    expect(wrapper.find('#zoom_options').exists()).toBe(false);
  });

  it('validates custom zoom and applies valid values', async () => {
    const wrapper = mount(ZoomControl, { props: { modelValue: 100 } });

    await wrapper.get('[data-testid="zoom_toggle"]').trigger('click');
    await wrapper.get('input').setValue('999');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();

    await wrapper.get('input').setValue('125');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('update:modelValue')).toEqual([[125]]);
  });

  it('closes on Escape and outside pointer interaction', async () => {
    const wrapper = mount(ZoomControl, { attachTo: document.body, props: { modelValue: 100 } });

    await wrapper.get('[data-testid="zoom_toggle"]').trigger('click');
    await wrapper.get('.zoom_control').trigger('keydown', { key: 'Escape' });

    expect(wrapper.find('#zoom_options').exists()).toBe(false);

    await wrapper.get('[data-testid="zoom_toggle"]').trigger('click');
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('#zoom_options').exists()).toBe(false);

    wrapper.unmount();
  });
});
