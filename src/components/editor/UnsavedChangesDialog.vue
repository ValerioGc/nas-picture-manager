<script setup lang="ts">

import { onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useViewerStore } from '@/stores/viewerStore';
import { useI18n } from '@/i18n';

const viewer = useViewerStore();
const { t } = useI18n();
const { leaveContext } = storeToRefs(viewer);

const dialog = ref<HTMLDialogElement | null>(null);

onMounted(() => dialog.value?.showModal());
onBeforeUnmount(() => {
  dialog.value?.close();
  viewer.confirmLeave(false);
});

</script>

<template>
  <dialog
    ref="dialog"
    class="unsaved_dialog"
    data-testid="unsaved_dialog"
    aria-labelledby="unsaved_title"
    aria-describedby="unsaved_message"
    @cancel.prevent="viewer.confirmLeave(false)"
    @close="viewer.confirmLeave(false)"
  >
    <h2 id="unsaved_title">{{ t('edit.unsaved_title') }}</h2>
    <p id="unsaved_message">
      {{ t(leaveContext === 'panel' ? 'edit.leave_panel' : 'edit.discard') }}
    </p>

    <!-- Dialog actions -->
    <div class="dialog_actions">
      <button data-testid="unsaved_cancel" autofocus @click="viewer.confirmLeave(false)">
        {{ t(leaveContext === 'panel' ? 'edit.keep_editing' : 'edit.cancel') }}
      </button>
      <button
        class="discard_button"
        data-testid="unsaved_discard"
        @click="viewer.confirmLeave(true)"
      >
        {{ t(leaveContext === 'panel' ? 'edit.leave_panel_confirm' : 'edit.discard_confirm') }}
      </button>
    </div>
  </dialog>
</template>

<style scoped lang="scss">

.unsaved_dialog {
  @extend %popup_surface;
  margin: auto;
  width: min($empty_width, calc(100% - $space_8));
  padding: $space_6;
  color: var(--theme-foreground);

  &::backdrop {
    background: var(--crop-mask);
  }
}

h2 {
  margin-bottom: $space_3;
  font-size: $font_title;
}

p {
  line-height: 1.7;
}

.dialog_actions {
  display: flex;
  justify-content: flex-end;
  gap: $space_2;
  margin-top: $space_6;
}

button {
  padding: $space_3;
  border: $border_width solid var(--border);
}

.discard_button {
  background: var(--accent);
  color: var(--on-accent);
}

</style>
