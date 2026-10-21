import { useGlobalStore } from '@/stores/globalStore';
import { useViewerStore } from '@/stores/viewerStore';

export function useImageDrop() {
  const global = useGlobalStore();
  const viewer = useViewerStore();
  let depth = 0;

  function enter(event: DragEvent) {
    if (event.dataTransfer?.types.includes('Files')) {
      depth++;
      global.set_dragging(true);
    }
  }

  function leave() {
    depth = Math.max(0, depth - 1);
    if (!depth) {
      global.set_dragging(false);
    }
  }

  function drop(event: DragEvent) {
    depth = 0;
    global.set_dragging(false);
    void viewer.selectFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  return { enter, leave, drop };
}
