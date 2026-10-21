<script setup lang="ts">

import { computed, ref } from 'vue';
import { useI18n } from '@/i18n';
import type { CropRectangle } from '@/types/types';

interface Props {
  width: number;
  height: number;
  ratio: string;
}

const props = defineProps<Props>();

const crop = defineModel<CropRectangle>({ required: true });
const { t } = useI18n();

const root = ref<HTMLElement | null>(null);

let origin: { x: number; y: number } | null = null;

const rectangleStyle = computed(() => ({
  left: `${(crop.value.x / props.width) * 100}%`,
  top: `${(crop.value.y / props.height) * 100}%`,
  width: `${(crop.value.width / props.width) * 100}%`,
  height: `${(crop.value.height / props.height) * 100}%`,
}));

function point(event: PointerEvent) {
  const bounds = root.value?.getBoundingClientRect();
  if (!bounds) {
    return { x: 0, y: 0 };
  }

  return {
    x: Math.round(
      Math.max(
        0,
        Math.min(props.width, ((event.clientX - bounds.left) / bounds.width) * props.width),
      ),
    ),
    y: Math.round(
      Math.max(
        0,
        Math.min(props.height, ((event.clientY - bounds.top) / bounds.height) * props.height),
      ),
    ),
  };
}

function start(event: PointerEvent) {
  if (event.button !== 0) {
    return;
  }

  origin = point(event);
  root.value?.setPointerCapture(event.pointerId);
}

function move(event: PointerEvent) {
  if (!origin) {
    return;
  }

  const current = point(event);
  let width = Math.abs(current.x - origin.x);
  let height = Math.abs(current.y - origin.y);
  if (props.ratio !== 'free') {
    const [a, b] = props.ratio.split(':').map(Number);
    if (a && b) {
      width = Math.min(width, (height * a) / b);
      height = (width * b) / a;
    }
  }

  width = Math.max(1, Math.floor(width));
  height = Math.max(1, Math.floor(height));
  crop.value = {
    x: Math.min(props.width - width, current.x < origin.x ? origin.x - width : origin.x),
    y: Math.min(props.height - height, current.y < origin.y ? origin.y - height : origin.y),
    width,
    height,
  };
}

function finish(event: PointerEvent) {
  if (!origin) {
    return;
  }

  move(event);
  origin = null;
  root.value?.releasePointerCapture(event.pointerId);
}

</script>

<template>
  <div
    ref="root"
    class="crop_surface"
    data-testid="crop_surface"
    :aria-label="t('edit.crop.drag')"
    @pointerdown.prevent="start"
    @pointermove="move"
    @pointerup="finish"
    @pointercancel="origin = null"
  >
    <div class="crop_rectangle" :style="rectangleStyle">
      <span>{{ t('edit.crop.drag') }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">

.crop_surface {
  position: absolute;
  inset: 0;
  touch-action: none;
  cursor: crosshair;
  overflow: hidden;
}

.crop_rectangle {
  position: absolute;
  border: $focus_width solid var(--accent);
  box-shadow: 0 0 0 $crop_mask_size var(--crop-mask);
}

span {
  position: absolute;
  left: $space_2;
  top: $space_2;
  padding: $space_1 $space_2;
  background: var(--surface);
  color: var(--theme-foreground);
  font-size: $font_small;
  white-space: nowrap;
  pointer-events: none;
}

</style>
