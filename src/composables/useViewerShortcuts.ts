import { onBeforeUnmount, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useGlobalStore } from '@/stores/globalStore';
import { useViewerStore } from '@/stores/viewerStore';

interface ViewerShortcuts {
  closePanel: () => void;
  open: () => void;
}

export function useViewerShortcuts({ closePanel, open }: ViewerShortcuts) {
  const viewer = useViewerStore();
  const global = useGlobalStore();
  const { unsaved, saving, imageReady, zoom } = storeToRefs(viewer);
  function beforeUnload(event: BeforeUnloadEvent) {
    if (unsaved.value || saving.value) {
      event.preventDefault();
    }
  }

  const shortcuts: Record<string, () => void> = {
    arrowleft: () => viewer.navigate(-1),
    arrowright: () => viewer.navigate(1),
    i: () => viewer.togglePanel('info'),
    e: () => viewer.togglePanel('edit'),
    escape: closePanel,
  };

  function annotationShortcut(event: KeyboardEvent, key: string, modified: boolean) {
    if (
      global.panel !== 'edit' ||
      !viewer.annotationTool ||
      viewer.saving ||
      viewer.cropping ||
      viewer.annotating
    ) {
      return;
    }
    if (modified && key === 'z') {
      return event.shiftKey ? () => viewer.redoAnnotation() : () => viewer.undoAnnotation();
    }
    if (modified && key === 'y') {
      return () => viewer.redoAnnotation();
    }
    if (key === 'delete' || key === 'backspace') {
      return () => viewer.removeAnnotation();
    }
  }

  function viewerShortcut(event: KeyboardEvent, key: string, modified: boolean) {
    if (modified && key === 'o') {
      return open;
    }
    if (modified && ['1', '2', '3'].includes(key) && imageReady.value) {
      return () => {
        zoom.value = Number(key) * 100;
      };
    }
    if (!modified && !event.altKey) {
      return shortcuts[key];
    }
  }

  function keydown(event: KeyboardEvent) {
    if (event.defaultPrevented || viewer.leaveConfirmation) {
      return;
    }

    const key = event.key.toLowerCase();
    const modified = event.ctrlKey || event.metaKey;
    if (modified && key === 's') {
      event.preventDefault();
      void viewer.save();
      return;
    }
    if (
      event.target instanceof HTMLElement &&
      event.target.closest('input, select, textarea, [contenteditable=true]')
    ) {
      return;
    }

    const action = annotationShortcut(event, key, modified) ?? viewerShortcut(event, key, modified);
    if (action) {
      event.preventDefault();
      action();
    }
  }

  function preventWindowPinch(event: WheelEvent) {
    if (event.ctrlKey && imageReady.value) {
      event.preventDefault();
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', keydown);
    document.addEventListener('wheel', preventWindowPinch, { passive: false });
    window.addEventListener('beforeunload', beforeUnload);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', keydown);
    document.removeEventListener('wheel', preventWindowPinch);
    window.removeEventListener('beforeunload', beforeUnload);
  });
}
