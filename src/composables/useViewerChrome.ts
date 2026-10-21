import { onBeforeUnmount, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useGlobalStore } from '@/stores/globalStore';
import { useViewerStore } from '@/stores/viewerStore';

export function useViewerChrome() {
  const global = useGlobalStore();
  const { imageReady: image_ready } = storeToRefs(useViewerStore());
  let timer: ReturnType<typeof setTimeout> | undefined;

  function hide() {
    const focused_chrome = document.activeElement?.closest(
      '[data-testid="viewer_toolbar"], [data-testid="viewer_footer"]',
    );

    if (image_ready.value && !focused_chrome) {
      global.hide_chrome();
    }
  }

  function show() {
    if (!image_ready.value) {
      return;
    }

    global.show_chrome();
    clearTimeout(timer);
    timer = setTimeout(hide, 5000);
  }

  watch(image_ready, (ready) => {
    clearTimeout(timer);
    global.show_chrome();
    if (ready) {
      show();
    }
  });

  onBeforeUnmount(() => clearTimeout(timer));

  return { show };
}
