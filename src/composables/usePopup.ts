import { onBeforeUnmount, onMounted, ref } from 'vue';

export function usePopup() {
  const is_expanded = ref(false);
  const root = ref<HTMLElement | null>(null);
  const trigger = ref<HTMLButtonElement | null>(null);

  function close(restoreFocus = false) {
    is_expanded.value = false;
    if (restoreFocus) {
      trigger.value?.focus();
    }
  }

  function outside(event: PointerEvent) {
    if (event.target instanceof Node && !root.value?.contains(event.target)) {
      close();
    }
  }

  onMounted(() => document.addEventListener('pointerdown', outside));
  onBeforeUnmount(() => document.removeEventListener('pointerdown', outside));
  return { expanded: is_expanded, root, trigger, close };
}
