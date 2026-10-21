<script setup lang="ts">

import { useI18n } from '@/i18n';
import { useGlobalStore } from '@/stores/globalStore';
import { useViewerStore } from '@/stores/viewerStore';
import { storeToRefs } from 'pinia';

import leftIcon from '@/assets/icons/left.svg?no-inline';
import rightIcon from '@/assets/icons/right.svg?no-inline';
import ZoomControl from '@/components/controls/ZoomControl.vue';

const viewer = useViewerStore();
const { index, entries, displayedInfo, displayedPreview, saving, zoom } = storeToRefs(viewer);
const { chrome_visible, panel } = storeToRefs(useGlobalStore());
const { t, number } = useI18n();

</script>

<template>
  <footer
    class="viewer_footer"
    :class="{ viewer_footer_hidden: !chrome_visible || !!panel }"
    data-testid="viewer_footer"
  >
    <div class="navigation" data-testid="image_navigation">
      <button
        data-testid="previous_image"
        :disabled="saving || index === 0 || entries.length === 0"
        :aria-label="t('viewer.previous')"
        :title="t('viewer.previous')"
        @click="viewer.navigate(-1)"
      >
        <span class="icon" :style="{ '--icon_url': `url(${leftIcon})` }" aria-hidden="true"></span>
      </button>
      <button
        data-testid="next_image"
        :disabled="saving || index >= entries.length - 1"
        :aria-label="t('viewer.next')"
        :title="t('viewer.next')"
        @click="viewer.navigate(1)"
      >
        <span class="icon" :style="{ '--icon_url': `url(${rightIcon})` }" aria-hidden="true"></span>
      </button>
    </div>

    <span v-if="displayedPreview && displayedInfo" class="image_summary">
      {{ number(displayedInfo.width) }} × {{ number(displayedInfo.height) }}
      <span>· {{ displayedInfo.format }}</span>
    </span>

    <ZoomControl v-if="displayedPreview && displayedInfo" v-model="zoom" />
  </footer>
</template>

<style scoped lang="scss">

.viewer_footer {
  display: grid;
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 3;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: $space_3;
  flex-shrink: 0;
  min-height: $toolbar_height;
  padding: $space_3 $space_6;
  transition: transform $duration_panel ease;
}

.viewer_footer_hidden {
  transform: translateY(100%);
}

.navigation {
  display: flex;
  gap: $space_1;
  padding: $space_1;
  background: var(--surface);
  border: $border_width solid var(--border);
  border-radius: $radius_medium;

  button {
    display: grid;
    place-items: center;
    width: $control_size;
    height: $control_size;
  }
}

.image_summary {
  @extend %muted_label;
  font-variant-numeric: tabular-nums;
  text-align: center;
  white-space: nowrap;
}

.viewer_footer :deep(.zoom_control) {
  grid-column: 3;
  justify-self: end;
}

@media (max-width: $breakpoint_compact) {
  .image_summary {
    display: none;
  }

  .viewer_footer {
    padding: $space_3;
  }
}

</style>
