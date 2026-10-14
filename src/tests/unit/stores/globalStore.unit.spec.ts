import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGlobalStore } from '@/stores/globalStore';

describe('globalStore', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('coordinates the active panel and shared UI flags', () => {
    const global = useGlobalStore();

    global.toggle_panel('edit', false);
    expect(global.panel).toBeNull();

    global.toggle_panel('edit', true);
    expect(global.panel).toBe('edit');

    global.toggle_panel('info', true);
    expect(global.panel).toBe('info');

    expect(global.close_panel()).toBe('info');
    expect(global.panel).toBeNull();

    global.set_dragging(true);
    global.hide_chrome();

    expect(global.is_dragging).toBe(true);
    expect(global.chrome_visible).toBe(false);
  });
});
