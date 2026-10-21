<script setup lang="ts">

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useImageDrop } from '@/composables/useImageDrop';
import { imageAccept } from '@/composables/useImageViewer';
import { useViewerChrome } from '@/composables/useViewerChrome';
import { useViewerShortcuts } from '@/composables/useViewerShortcuts';
import { useTheme } from '@/composables/useTheme';
import { useI18n } from '@/i18n';
import { useGlobalStore } from '@/stores/globalStore';
import { useViewerStore } from '@/stores/viewerStore';
import { pickNasFiles } from '@/services/nasShell';

import ImageStage from '@/components/ImageStage.vue';
import openIcon from '@/assets/icons/open.svg?no-inline';
import UnsavedChangesDialog from '@/components/editor/UnsavedChangesDialog.vue';
import CommonSidebar from '@/components/layout/CommonSidebar.vue';
import ViewerFooter from '@/components/layout/ViewerFooter.vue';
import ViewerToolbar from '@/components/layout/ViewerToolbar.vue';

const { t } = useI18n();

useTheme();

const global = useGlobalStore();
const { panel, is_dragging } = storeToRefs(global);
const viewer = useViewerStore();
const { entries, preview, error, processing, editError, leaveConfirmation } = storeToRefs(viewer);
const fileInput = ref<HTMLInputElement | null>(null);
const pathError = ref(false);
const inLauncher = window.parent !== window;
const pickerError = ref(false);
let picking = false;

async function openLinkedImage() {
  const path = new URLSearchParams(window.location.search).get('path');
  if (!path?.startsWith('/') || path.length > 2048) {
    return;
  }
  
  try {
    const response = await fetch(
      `/apps/nas-file-manager/api/downloads?path=${encodeURIComponent(path.slice(1))}`,
    );
    if (!response.ok) {
      throw new Error('Unable to read image');
    }
    const blob = await response.blob();
    if (blob.size > 30 * 1024 * 1024) {
      throw new Error('Image is too large');
    }
    const name = path.split('/').at(-1) || 'image';
    await viewer.selectFiles([new File([blob], name, { type: blob.type })]);
    pathError.value = false;
  } catch {
    pathError.value = true;
  }
}

onMounted(() => void openLinkedImage());

async function closePanel() {
  const previous = await viewer.closePanel();
  if (previous) {
    document.getElementById(previous === 'info' ? 'info_toggle' : 'edit_toggle')?.focus();
  }
}

async function open() {
  if (!inLauncher) {
    fileInput.value?.click();
    return;
  }
  if (picking) {
    return;
  }
  picking = true;
  try {
    const result = await pickNasFiles({ multiple: true, extensions: imageAccept.split(',') });
    if (result.cancelled) {
      return;
    }
    pickerError.value = Boolean(result.error);
    if (!result.error && result.files.length) {
      pathError.value = false;
      await viewer.selectFiles(result.files);
    }
  } finally {
    picking = false;
  }
}

async function selected(event: Event) {
  const input = event.target as HTMLInputElement;
  pathError.value = false;
  await viewer.selectFiles(Array.from(input.files ?? []));
  input.value = '';
}

const { drop, enter: dragEnter, leave: dragLeave } = useImageDrop();

const { show: showChrome } = useViewerChrome();

useViewerShortcuts({ closePanel, open });

const statusError = computed(() => {
  if (pickerError.value) {
    return t('viewer.pickerUnavailable');
  }
  if (pathError.value) {
    return t('viewer.error.unavailable');
  }
  if (editError.value && panel.value !== 'edit') {
    return t(`viewer.error.${editError.value}`);
  }

  if (error.value && preview.value) {
    return t(`viewer.error.${error.value}`);
  }

  return '';
});

onBeforeUnmount(() => viewer.$dispose());

</script>

<template>
  <div class="app app_surface">
    <UnsavedChangesDialog v-if="leaveConfirmation" />

    <main
      class="viewer"
      data-testid="image_viewer"
      @dragover.prevent
      @drop.prevent="drop"
      @dragenter.prevent="dragEnter"
      @dragleave.prevent="dragLeave"
      @mousemove="showChrome"
      @focusin="showChrome"
    >
      <ViewerToolbar @open="open" />

      <input
        v-if="!inLauncher"
        ref="fileInput"
        class="file_input"
        data-testid="file_input"
        type="file"
        multiple
        :accept="imageAccept"
        :aria-label="t('viewer.open')"
        @change="selected"
      />

      <div class="workspace">
        <section class="image_workspace" :aria-label="t('viewer.title')">
          <ImageStage @open="open" />

          <ViewerFooter v-if="entries.length" />
        </section>

        <Transition name="panel">
          <CommonSidebar v-if="panel" @close="closePanel" />
        </Transition>
      </div>

      <div v-if="is_dragging" class="drop_overlay">
        <span class="icon" :style="{ '--icon_url': `url(${openIcon})` }" aria-hidden="true"></span>
        <p>{{ t('viewer.drop') }}</p>
      </div>

      <output v-if="processing && panel !== 'edit'" class="window_error">
        {{ t('edit.processing') }}
      </output>

      <p v-if="statusError" class="window_error" role="alert">{{ statusError }}</p>
    </main>
  </div>
</template>

<style scoped lang="scss">

.app {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.viewer {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
}

.file_input {
  display: none;
}

.workspace {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
}

.image_workspace {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.drop_overlay {
  position: absolute;
  inset: $space_3;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $space_5;
  background: var(--surface);
  border: $focus_width dashed var(--accent);
  border-radius: $radius_large;
  pointer-events: none;
  color: var(--accent);
}

.window_error {
  position: absolute;
  bottom: $toolbar_height;
  align-self: center;
  padding: $space_3;
  background: var(--surface);
  color: var(--danger);
}

.panel-enter-active,
.panel-leave-active {
  transition:
    transform $duration_panel ease,
    opacity $duration_panel ease;
}

.panel-enter-from,
.panel-leave-to {
  transform: translateX($space_8);
  opacity: 0;
}

</style>
