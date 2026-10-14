<script setup lang="ts">

import { useAnnotationSurface } from '@/composables/useAnnotationSurface';
import { useI18n } from '@/i18n';

const { t } = useI18n();
const {
  root,
  canvas,
  resizeHandle,
  selectedBounds,
  selectionStyle,
  handleStyle,
  resizable,
  interactive,
  start,
  move,
  finish,
  keydown,
} = useAnnotationSurface();

</script>

<template>
  <div
    ref="root"
    class="annotation_surface"
    :class="{ interactive }"
    data-testid="annotation_surface"
    :tabindex="interactive ? 0 : -1"
    :aria-label="t('annotations.surface')"
    @pointerdown.prevent="start($event)"
    @pointermove="move"
    @pointerup="finish($event)"
    @pointercancel="finish($event, true)"
    @lostpointercapture="finish($event, true)"
    @dblclick.stop
    @keydown="keydown"
  >
    <canvas ref="canvas" :aria-label="t('annotations.surface')"></canvas>
    <template v-if="interactive && selectedBounds">
      <div class="annotation_selection" :style="selectionStyle"></div>
      <button
        v-if="resizable"
        ref="resizeHandle"
        class="annotation_handle"
        :style="handleStyle"
        data-testid="annotation_resize"
        :aria-label="t('annotations.resize')"
        @pointerdown.stop.prevent="start($event, true)"
      ></button>
    </template>
  </div>
</template>

<style scoped lang="scss">

.annotation_surface {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.interactive {
  pointer-events: auto;
  touch-action: none;
  cursor: crosshair;
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.annotation_selection {
  position: absolute;
  border: $border_width dashed var(--accent);
  pointer-events: none;
}

.annotation_handle {
  position: absolute;
  width: $space_3;
  height: $space_3;
  border: $border_width solid var(--surface);
  background: var(--accent);
  transform: translate(-50%, -50%);
  cursor: nwse-resize;
}

</style>
