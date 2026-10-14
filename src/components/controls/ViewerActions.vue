<script setup lang="ts">

import { useI18n } from '@/i18n';

import { useGlobalStore } from '@/stores/globalStore';
import { useViewerStore } from '@/stores/viewerStore';
import { storeToRefs } from 'pinia';

import editIcon from '@/assets/icons/edit.svg?no-inline';
import infoIcon from '@/assets/icons/info.svg?no-inline';
import ViewerOptions from '@/components/controls/ViewerOptions.vue';

const { t } = useI18n();
const global = useGlobalStore();
const viewer = useViewerStore();
const { panel } = storeToRefs(global);
const { imageReady } = storeToRefs(viewer);

const emit = defineEmits<{ open: [] }>();

const panels = ['edit', 'info'] as const;

const toolIcons = {
  edit: editIcon,
  info: infoIcon,
};

</script>

<template>
  <div class="viewer_actions">
    <template v-if="imageReady">
      <button
        v-for="item in panels"
        :id="`${item}_toggle`"
        :key="item"
        :data-testid="`${item}_toggle`"
        :aria-label="t(`panel.${item}`)"
        :title="t(`panel.${item}`)"
        :aria-pressed="panel === item"
        :disabled="!imageReady"
        @click="viewer.togglePanel(item)"
      >
        <span
          class="icon"
          :style="{ '--icon_url': `url(${toolIcons[item]})` }"
          aria-hidden="true"
        ></span>
      </button>
    </template>

    <ViewerOptions @open="emit('open')" />
  </div>
</template>

<style scoped lang="scss">

.viewer_actions {
  @extend %fx_base;
  gap: $space_1;
}

button {
  @extend %icon_button;
}

button[aria-pressed='true'] {
  @extend %selected_control;
}

</style>
