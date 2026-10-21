import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Sidebar } from '@/types/types';

export const useGlobalStore = defineStore('global', () => {
  const panel = ref<Sidebar>(null);
  const is_dragging = ref(false);
  const chrome_visible = ref(true);

  function toggle_panel(next: Sidebar, image_ready: boolean) {
    if (!next || image_ready) {
      panel.value = panel.value === next ? null : next;
    }
  }

  function close_panel() {
    const previous = panel.value;
    panel.value = null;
    return previous;
  }

  function set_dragging(value: boolean) {
    is_dragging.value = value;
  }

  function show_chrome() {
    chrome_visible.value = true;
  }

  function hide_chrome() {
    chrome_visible.value = false;
  }

  return {
    panel,
    is_dragging,
    chrome_visible,
    toggle_panel,
    close_panel,
    set_dragging,
    show_chrome,
    hide_chrome,
  };
});
