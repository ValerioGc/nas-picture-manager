import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useViewerChrome } from '@/composables/useViewerChrome';
import { useGlobalStore } from '@/stores/globalStore';
import { useViewerStore } from '@/stores/viewerStore';
import { imageDocument } from '@tests/fixtures';

function mountChrome() {
  const component = defineComponent({
    setup() {
      useViewerChrome();
      return {};
    },
    template: '<div />',
  });

  return mount(component);
}

function setReady(ready: boolean) {
  const viewer = useViewerStore();
  viewer.info = ready ? imageDocument().info : null;
  viewer.preview = ready ? 'blob:image' : '';
}

describe('useViewerChrome', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it('hides after five seconds and keeps the chrome visible while focused', async () => {
    const wrapper = mountChrome();
    const global = useGlobalStore();

    setReady(true);
    await nextTick();
    await vi.advanceTimersByTimeAsync(5000);

    expect(global.chrome_visible).toBe(false);

    const chrome = document.createElement('div');
    chrome.dataset.testid = 'viewer_toolbar';
    const button = document.createElement('button');
    chrome.append(button);
    document.body.append(chrome);
    button.focus();

    setReady(false);
    await nextTick();
    setReady(true);
    await nextTick();
    await vi.advanceTimersByTimeAsync(5000);

    expect(global.chrome_visible).toBe(true);
    chrome.remove();
    wrapper.unmount();
  });

  it('cleans up its pending timer on unmount', async () => {
    const wrapper = mountChrome();
    const global = useGlobalStore();

    setReady(true);
    await nextTick();
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(5000);

    expect(global.chrome_visible).toBe(true);
  });
});
