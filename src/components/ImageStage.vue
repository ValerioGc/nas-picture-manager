<script setup lang="ts">

import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useI18n } from '@/i18n';
import { useViewerStore } from '@/stores/viewerStore';
import { storeToRefs } from 'pinia';

import imageErrorIcon from '@/assets/icons/image_error.svg?no-inline';
import openIcon from '@/assets/icons/open.svg?no-inline';
import CropSelection from '@/components/editor/CropSelection.vue';
import AnnotationSurface from '@/components/editor/AnnotationSurface.vue';

const viewer = useViewerStore();
const {
  displayedInfo,
  displayedPreview,
  loading,
  processing,
  error,
  zoom,
  cropping,
  crop,
  dimensions,
  cropRatio,
  annotations,
  annotationTool,
} = storeToRefs(viewer);

const emit = defineEmits<{ open: [] }>();
const { t } = useI18n();

const viewport = ref<HTMLElement | null>(null);
const viewportSize = ref({ width: 0, height: 0 });
const canvasPadding = ref(0);
let observer: ResizeObserver | undefined;

const imageStyle = computed(() => {
  if (!displayedInfo.value) {
    return {};
  }

  const scale =
    zoom.value === 'fit'
      ? Math.max(
          0.01,
          Math.min(
            1,
            (viewportSize.value.width - canvasPadding.value) / displayedInfo.value.width,
            (viewportSize.value.height - canvasPadding.value) / displayedInfo.value.height,
          ),
        )
      : zoom.value / 100;

  return {
    width: `${displayedInfo.value.width * scale}px`,
    height: `${displayedInfo.value.height * scale}px`,
  };
});

function zoomWithGesture(event: WheelEvent) {
  if (!event.ctrlKey || !displayedInfo.value) {
    return;
  }

  event.preventDefault();
  const current = zoom.value === 'fit' ? 100 : zoom.value;
  const delta = event.deltaY < 0 ? 10 : -10;
  zoom.value = Math.min(400, Math.max(10, current + delta));
}

onMounted(() => {
  if (viewport.value) {
    canvasPadding.value =
      Number.parseFloat(getComputedStyle(viewport.value).getPropertyValue('--canvas-padding')) *
        2 || 0;
  }

  observer = new ResizeObserver(([entry]) => {
    if (entry) {
      viewportSize.value = { width: entry.contentRect.width, height: entry.contentRect.height };
    }
  });

  if (viewport.value) {
    observer.observe(viewport.value);
  }
});

onBeforeUnmount(() => observer?.disconnect());

</script>

<template>
  <div
    ref="viewport"
    class="viewport"
    data-testid="image_viewport"
    :aria-busy="loading || processing"
    @wheel="zoomWithGesture"
  >
    <div v-if="displayedPreview && displayedInfo" class="image_canvas">
      <div class="picture_frame">
        <img
          class="picture"
          data-testid="picture"
          :src="displayedPreview"
          :alt="displayedInfo.name"
          :style="imageStyle"
          draggable="false"
        />

        <AnnotationSurface v-if="annotations.length || annotationTool" />

        <CropSelection
          v-if="cropping && !processing"
          v-model="crop"
          :width="dimensions.width"
          :height="dimensions.height"
          :ratio="cropRatio"
        />
      </div>
    </div>

    <div v-if="processing && displayedPreview" class="loading_overlay" aria-hidden="true">
      <span class="spinner" aria-hidden="true"></span>
    </div>

    <output v-else-if="loading" class="center_message">
      <span class="spinner" aria-hidden="true"></span>
      <span>{{ t('viewer.loading') }}</span>
    </output>

    <div v-else-if="error" class="center_message">
      <section
        class="error_message"
        role="alert"
        aria-labelledby="image_error_title"
        data-testid="image_error"
      >
        <div class="error_icon">
          <span
            class="icon"
            :style="{ '--icon_url': `url(${imageErrorIcon})` }"
            aria-hidden="true"
          ></span>
        </div>
        <h1 id="image_error_title">{{ t('viewer.error.title') }}</h1>
        <p>{{ t(`viewer.error.${error}`) }}</p>
        <button class="primary_button" @click="emit('open')">
          <span
            class="icon"
            :style="{ '--icon_url': `url(${openIcon})` }"
            aria-hidden="true"
          ></span>
          {{ t('viewer.retry') }}
        </button>
      </section>
    </div>

    <div
      v-else-if="!displayedPreview || !displayedInfo"
      class="empty_state"
      data-testid="empty_state"
    >
      <h1>{{ t('viewer.empty.title') }}</h1>
      <p>{{ t('viewer.empty.drop') }}</p>
      <button class="primary_button" data-testid="open_images" @click="emit('open')">
        {{ t('viewer.open') }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">

.viewport {
  --canvas-padding: #{$space_6};
  flex: 1;
  min-height: 0;
  overflow: auto;
  position: relative;
  touch-action: pan-x pan-y;
}

.image_canvas {
  display: grid;
  place-items: center;
  min-width: 100%;
  min-height: 100%;
  width: max-content;
  height: max-content;
  padding: $space_6;
}

.picture_frame {
  position: relative;
}

.picture {
  display: block;
  max-width: none;
  background-image: repeating-conic-gradient(var(--checker) 0% 25%, transparent 0% 50%);
  background-position: center;
  background-size: $space_4 $space_4;
}

.empty_state,
.center_message {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: $space_5;
  padding: $space_8;
}

.loading_overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
  background: var(--surface-soft);
  opacity: 0.8;
}

.spinner {
  width: $space_8;
  height: $space_8;
  color: var(--accent);
  background: conic-gradient(
    from -45deg,
    currentColor 0deg 120deg,
    var(--accent-soft) 120deg 220deg,
    var(--border) 220deg 360deg
  );
  mask: radial-gradient(farthest-side, transparent calc(100% - $space_1), currentColor 0);
  animation: spin $duration_slow linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty_state h1 {
  font-size: $font_hero;
  font-weight: 500;
  letter-spacing: -0.025em;
}

.empty_state p {
  color: var(--muted);
}

.primary_button {
  display: flex;
  align-items: center;
  gap: $space_3;
  padding: $space_3 $space_5;
  background: var(--accent);
  color: var(--on-accent);
  font-weight: 600;
}

.primary_button:hover {
  background: var(--accent);
  filter: brightness(1.1);
}

.center_message {
  gap: $space_4;
  color: var(--muted);
}

.error_message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $space_4;
  width: 100%;
  max-width: $empty_width;
  padding: $space_8;
  border: $border_width solid var(--border);
  border-radius: $radius_large;
  background: var(--surface);
}

.error_icon {
  display: grid;
  place-items: center;
  width: $space_16;
  height: $space_16;
  border-radius: $radius_medium;
  color: var(--danger);
  background: var(--danger-soft);
}

.error_icon .icon {
  width: $space_8;
  height: $space_8;
}

.error_message h1 {
  font-size: $font_title;
  font-weight: 600;
  color: var(--theme-foreground);
}

.error_message p {
  line-height: 1.6;
}

.error_message .primary_button {
  margin-top: $space_2;
}

</style>
