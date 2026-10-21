<script setup lang="ts">

import { useGlobalStore } from '@/stores/globalStore';
import { useViewerStore } from '@/stores/viewerStore';
import { storeToRefs } from 'pinia';

import ViewerActions from '@/components/controls/ViewerActions.vue';

const { chrome_visible } = storeToRefs(useGlobalStore());
const { currentName, imageReady } = storeToRefs(useViewerStore());

const emit = defineEmits<{ open: [] }>();

</script>
<template>
  <header
    class="viewer_toolbar"
    :class="{ viewer_toolbar_hidden: imageReady && !chrome_visible }"
    data-testid="viewer_toolbar"
  >
    <div v-if="imageReady" class="viewer_identity">
      <span class="file_name" data-testid="file_name" :title="currentName">
        {{ currentName }}
      </span>
    </div>
    <ViewerActions @open="emit('open')" />
  </header>
</template>
<style scoped lang="scss">

.viewer_toolbar {
  @extend %fx_base;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 3;
  gap: $space_3;
  padding: $space_2 $space_4;
  flex-shrink: 0;
  background: var(--surface);
  border-bottom: $border_width solid var(--border);
  transition: transform $duration_panel ease;

  &.viewer_toolbar_hidden {
    transform: translateY(-100%);
  }
}

.viewer_identity {
  @extend %centered_identity;
  max-width: calc(100% - (($control_size * 3) + ($space_3 * 3)) * 2);
  gap: $space_3;
}

.viewer_toolbar :deep(.viewer_actions) {
  margin-left: auto;
}

.file_name {
  @extend %truncated_text;
  flex: 1;
}

</style>
