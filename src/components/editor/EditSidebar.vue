<script setup lang="ts">

import { ref } from 'vue';
import { useI18n } from '@/i18n';
import { useViewerStore } from '@/stores/viewerStore';
import { storeToRefs } from 'pinia';

import AnnotationControls from '@/components/editor/AnnotationControls.vue';

import annotationsIcon from '@/assets/icons/annotations.svg?no-inline';
import cropIcon from '@/assets/icons/crop.svg?no-inline';
import flipIcon from '@/assets/icons/flip.svg?no-inline';
import modifyIcon from '@/assets/icons/modify.svg?no-inline';
import resetIcon from '@/assets/icons/reset.svg?no-inline';
import rotateIcon from '@/assets/icons/rotate.svg?no-inline';

const viewer = useViewerStore();
const {
  edits,
  crop,
  format,
  exportFormat,
  processing,
  saving,
  cropping,
  validCrop,
  cropRatio,
  dimensions,
  editError,
  savedName,
  unsaved,
  imageReady,
  annotating,
} = storeToRefs(viewer);

const { t, number } = useI18n();
const tool = ref<'crop' | 'rotate' | 'flip' | 'modify' | 'annotations'>('crop');
const controls = ['brightness', 'contrast', 'sharpness'] as const;
const cropRatios = ['free', '1:1', '4:3', '16:9'] as const;
const exportFormats = ['png', 'jpeg', 'webp', 'original'] as const;
const formatLabels = { png: 'PNG', jpeg: 'JPEG', webp: 'WebP' };

function rotate(direction: number) {
  edits.value = {
    ...edits.value,
    rotation: (edits.value.rotation + direction + 4) % 4,
    crop: null,
  };
}

function flip(axis: 'flipHorizontal' | 'flipVertical') {
  edits.value = { ...edits.value, [axis]: !edits.value[axis], crop: null };
}

const toolIcons = {
  crop: cropIcon,
  rotate: rotateIcon,
  flip: flipIcon,
  modify: modifyIcon,
  annotations: annotationsIcon,
};

</script>

<template>
  <div class="edit_sidebar">
    <div class="edit_controls">
      <p class="hint" data-testid="edit_notice">{{ t('edit.notice') }}</p>
      <p v-if="!imageReady" class="hint">{{ t('panel.empty') }}</p>

      <fieldset :disabled="!imageReady || saving || annotating">
        <h3>{{ t('edit.geometry') }}</h3>

        <div class="tool_group">
          <button
            v-for="name in ['crop', 'rotate', 'flip', 'modify', 'annotations'] as const"
            :key="name"
            :data-testid="`edit_${name}`"
            :aria-pressed="tool === name"
            :title="t(`edit.${name}`)"
            :disabled="cropping && name !== 'crop'"
            @click="tool = name"
          >
            <span
              class="icon"
              :style="{ '--icon_url': `url(${toolIcons[name]})` }"
              aria-hidden="true"
            ></span>
            <span>{{ t(`edit.${name}`) }}</span>
          </button>
        </div>

        <div class="tool_settings">
          <template v-if="tool === 'crop'">
            <button
              v-if="!cropping"
              class="outlined_button"
              data-testid="crop_start"
              :disabled="processing"
              @click="viewer.startCrop()"
            >
              {{ t('edit.crop.select') }}
            </button>

            <template v-else>
              <label for="crop_ratio">{{ t('edit.crop.ratio') }}</label>
              <select
                id="crop_ratio"
                data-testid="crop_ratio"
                :value="cropRatio"
                @change="viewer.setRatio(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="ratio in cropRatios" :key="ratio" :value="ratio">
                  {{ ratio === 'free' ? t('edit.crop.free') : ratio }}
                </option>
              </select>

              <div class="crop_fields">
                <label v-for="field in ['x', 'y', 'width', 'height'] as const" :key="field">
                  {{ t(`edit.crop.${field}`) }}

                  <input
                    v-model.number="crop[field]"
                    :data-testid="`crop_${field}`"
                    type="number"
                    :min="field === 'x' || field === 'y' ? 0 : 1"
                    :max="field === 'x' || field === 'width' ? dimensions.width : dimensions.height"
                    step="1"
                  />
                </label>
              </div>

              <p v-if="!validCrop" role="alert">{{ t('viewer.error.invalid_edits') }}</p>

              <div class="paired_buttons">
                <button data-testid="crop_cancel" @click="cropping = false">
                  {{ t('edit.cancel') }}
                </button>
                <button
                  class="outlined_button"
                  data-testid="crop_apply"
                  :disabled="!validCrop || processing"
                  @click="viewer.applyCrop()"
                >
                  {{ t('edit.crop.apply') }}
                </button>
              </div>
            </template>
          </template>

          <template v-else-if="tool === 'rotate'">
            <div class="paired_buttons">
              <button
                data-testid="rotate_left"
                :aria-label="t('edit.rotate.left')"
                @click="rotate(-1)"
              >
                ↶
              </button>
              <output>{{ number(edits.rotation * 90) }}°</output>
              <button
                data-testid="rotate_right"
                :aria-label="t('edit.rotate.right')"
                @click="rotate(1)"
              >
                ↷
              </button>
            </div>
          </template>

          <template v-else-if="tool === 'flip'">
            <div class="paired_buttons">
              <button
                data-testid="flip_horizontal"
                :aria-pressed="edits.flipHorizontal"
                @click="flip('flipHorizontal')"
              >
                {{ t('edit.flip.horizontal') }}
              </button>
              <button
                data-testid="flip_vertical"
                :aria-pressed="edits.flipVertical"
                @click="flip('flipVertical')"
              >
                {{ t('edit.flip.vertical') }}
              </button>
            </div>
          </template>

          <template v-else-if="tool === 'modify'">
            <h3>{{ t('edit.adjustments') }}</h3>
            <div v-for="control in controls" :key="control" class="adjustment">
              <div>
                <label :for="control">{{ t(`edit.${control}`) }}</label>
                <output :for="control">{{ number(edits[control]) }}</output>
              </div>
              <input
                :id="control"
                v-model.number="edits[control]"
                :data-testid="`edit_${control}`"
                type="range"
                :min="control === 'sharpness' ? 0 : -100"
                max="100"
              />
            </div>
          </template>

          <AnnotationControls v-else />
        </div>

        <button class="outlined_button" data-testid="edit_reset" @click="viewer.reset()">
          <span
            class="icon"
            :style="{ '--icon_url': `url(${resetIcon})` }"
            aria-hidden="true"
          ></span>
          {{ t('edit.reset') }}
        </button>
      </fieldset>
    </div>

    <fieldset class="export_controls" :disabled="!imageReady || saving || annotating">
      <label for="export_format">{{ t('edit.export.format') }}</label>

      <select id="export_format" v-model="format" data-testid="export_format">
        <option v-for="name in exportFormats" :key="name" :value="name">
          {{ name === 'original' ? t('edit.export.original') : formatLabels[name] }}
        </option>
      </select>

      <p v-if="exportFormat === 'jpeg'" class="hint">{{ t('edit.export.jpeg') }}</p>

      <button
        class="save_button"
        data-testid="edit_save"
        :disabled="processing || cropping"
        @click="viewer.save()"
      >
        {{ t(saving ? 'edit.saving' : 'edit.save') }}
      </button>

      <output v-if="processing" data-testid="edit_processing">{{ t('edit.processing') }}</output>
      <output v-else-if="savedName" data-testid="edit_saved">
        {{ t('edit.saved') }} {{ savedName }}
      </output>

      <p v-else-if="unsaved" class="hint" data-testid="edit_unsaved">{{ t('edit.unsaved') }}</p>
      <p v-if="editError" role="alert" data-testid="edit_error">
        {{ t(`viewer.error.${editError}`) }}
      </p>
    </fieldset>
  </div>
</template>

<style scoped lang="scss">

.edit_sidebar {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: $space_5;
}

.edit_controls {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: $space_5;
}

fieldset {
  border: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: $space_5;
}

.export_controls {
  flex-shrink: 0;
  gap: $space_3;
  padding-top: $space_5;
  border-top: $border_width solid var(--border);
}

.hint {
  @extend %hint;
}

h3 {
  font-size: $font_body;
  font-weight: 600;
}

.tool_group {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: $space_2;

  button {
    display: flex;
    flex-direction: column;
    align-items: center;
    grid-column: span 2;
    gap: $space_2;
    padding: $space_3 $space_2;
    background: var(--surface-soft);
    font-size: $font_small;

    &:nth-last-child(-n + 2) {
      grid-column: span 3;
    }
  }
}

button[aria-pressed='true'] {
  @extend %selected_control;
}

.tool_settings {
  border-block: $border_width solid var(--border);
  padding-block: $space_5;
  display: flex;
  flex-direction: column;
  gap: $space_3;
}

.paired_buttons {
  display: flex;
  gap: $space_2;
  align-items: center;
}

.paired_buttons button {
  padding: $space_2;
  flex: 1;
}

.crop_fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $space_2;

  label {
    display: grid;
    gap: $space_1;
    font-size: $font_small;
  }

  input {
    min-width: 0;
    width: 100%;
  }
}

.adjustment {
  display: flex;
  flex-direction: column;
  gap: $space_3;

  div {
    display: flex;
    justify-content: space-between;
  }

  output {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
}

input[type='range'] {
  width: 100%;
}

.outlined_button {
  display: flex;
  gap: $space_2;
  align-items: center;
  justify-content: center;
  padding: $space_3;
  border: $border_width solid var(--border);
}

.save_button {
  padding: $space_3;
  background: var(--accent);
  color: var(--on-accent);
}

[role='alert'] {
  color: var(--danger);
  font-size: $font_small;
}

</style>
