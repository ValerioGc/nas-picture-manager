import { mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import CropSelection from '@/components/editor/CropSelection.vue';

it('maps a pointer rectangle to image pixels', async () => {
  const wrapper = mount(CropSelection, {
    props: {
      width: 200,
      height: 100,
      ratio: 'free',
      modelValue: { x: 0, y: 0, width: 200, height: 100 },
    },
  });
  const element = wrapper.element as HTMLElement;

  element.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 400,
    height: 200,
    right: 400,
    bottom: 200,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  element.setPointerCapture = vi.fn();
  element.releasePointerCapture = vi.fn();
  element.dispatchEvent(
    new MouseEvent('pointerdown', { button: 0, clientX: 40, clientY: 20, bubbles: true }),
  );
  element.dispatchEvent(new MouseEvent('pointerup', { clientX: 240, clientY: 160, bubbles: true }));

  expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toEqual({
    x: 20,
    y: 10,
    width: 100,
    height: 70,
  });
});

it('ignores non-primary pointers and constrains a fixed ratio selection', async () => {
  const wrapper = mount(CropSelection, {
    props: {
      width: 100,
      height: 100,
      ratio: '1:1',
      modelValue: { x: 0, y: 0, width: 10, height: 10 },
    },
  });
  const element = wrapper.element as HTMLElement;

  element.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    right: 100,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  element.setPointerCapture = vi.fn();
  element.releasePointerCapture = vi.fn();
  element.dispatchEvent(new MouseEvent('pointerdown', { button: 1, bubbles: true }));
  element.dispatchEvent(new MouseEvent('pointermove', { clientX: 80, clientY: 20, bubbles: true }));

  expect(wrapper.emitted('update:modelValue')).toBeUndefined();

  element.dispatchEvent(
    new MouseEvent('pointerdown', { button: 0, clientX: 90, clientY: 90, bubbles: true }),
  );
  element.dispatchEvent(
    new MouseEvent('pointermove', { clientX: -10, clientY: 10, bubbles: true }),
  );
  element.dispatchEvent(new MouseEvent('pointercancel', { bubbles: true }));
  element.dispatchEvent(new MouseEvent('pointerup', { clientX: 0, clientY: 0, bubbles: true }));

  expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({
    width: 80,
    height: 80,
  });
});
