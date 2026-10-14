<script setup lang="ts">

import { computed, onBeforeUnmount, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useViewerStore } from '@/stores/viewerStore';
import { useI18n } from '@/i18n';
import type { AnnotationKind, AnnotationStyle } from '@/types/types';

import circleIcon from '@/assets/icons/circle.svg?no-inline';
import deleteIcon from '@/assets/icons/delete.svg?no-inline';
import editIcon from '@/assets/icons/edit.svg?no-inline';
import highlightIcon from '@/assets/icons/highlight.svg?no-inline';
import lineIcon from '@/assets/icons/line.svg?no-inline';
import rectangleIcon from '@/assets/icons/rectangle.svg?no-inline';
import redoIcon from '@/assets/icons/redo.svg?no-inline';
import selectIcon from '@/assets/icons/select.svg?no-inline';
import textIcon from '@/assets/icons/text.svg?no-inline';
import undoIcon from '@/assets/icons/undo.svg?no-inline';

interface AnnotationButton {
  id: string;
  label: AnnotationKind | 'undo' | 'redo' | 'select' | 'delete';
  icon: string;
  run: () => void;
  disabled: () => boolean;
  pressed?: () => boolean;
  className?: string;
}

interface NumericControl {
  type: 'range' | 'number';
  id: 'size' | 'opacity' | 'font_size';
  field: 'size' | 'opacity' | 'fontSize';
  min: number;
  max: number;
  step: number;
}

type StyleControl =
  | NumericControl
  | { type: 'color'; id: 'color' }
  | { type: 'checkbox'; id: 'fill' }
  | { type: 'text'; id: 'text' };

const viewer = useViewerStore();
const {
  annotationTool,
  annotationStyle,
  annotationText,
  selectedAnnotation,
  canUndoAnnotation,
  canRedoAnnotation,
  annotationLimit,
  cropping,
  annotating,
} = storeToRefs(viewer);
const { t, number } = useI18n();
const activeKind = computed(() => selectedAnnotation.value?.kind ?? annotationTool.value);
const blocked = () => cropping.value || annotating.value;

const toolIcons = {
  rectangle: rectangleIcon,
  circle: circleIcon,
  line: lineIcon,
  text: textIcon,
  pen: editIcon,
  highlight: highlightIcon,
};

const actions: AnnotationButton[] = [
  {
    id: 'undo',
    label: 'undo',
    icon: undoIcon,
    run: () => viewer.undoAnnotation(),
    disabled: () => !canUndoAnnotation.value || blocked(),
  },
  {
    id: 'redo',
    label: 'redo',
    icon: redoIcon,
    run: () => viewer.redoAnnotation(),
    disabled: () => !canRedoAnnotation.value || blocked(),
  },
  {
    id: 'tool_select',
    label: 'select',
    icon: selectIcon,
    run: () => viewer.setAnnotationTool('select'),
    disabled: blocked,
    pressed: () => annotationTool.value === 'select',
  },
  {
    id: 'delete',
    label: 'delete',
    icon: deleteIcon,
    run: () => viewer.removeAnnotation(),
    disabled: () => !selectedAnnotation.value || blocked(),
    className: 'delete_action',
  },
];
const tools = (['rectangle', 'circle', 'line', 'text', 'pen', 'highlight'] as const).map(
  (kind): AnnotationButton => ({
    id: `tool_${kind}`,
    label: kind,
    icon: toolIcons[kind],
    run: () => viewer.setAnnotationTool(kind),
    disabled: blocked,
    pressed: () => annotationTool.value === kind,
  }),
);
const buttonGroups = [
  { className: 'annotation_actions', label: 'title', buttons: actions },
  { className: 'annotation_toolbar', label: 'tool', buttons: tools },
] as const;

const styleControls: StyleControl[] = [
  { id: 'color', type: 'color' },
  { id: 'size', type: 'range', field: 'size', min: 1, max: 100, step: 1 },
  { id: 'opacity', type: 'range', field: 'opacity', min: 0.05, max: 1, step: 0.05 },
  { id: 'fill', type: 'checkbox' },
  { id: 'text', type: 'text' },
  { id: 'font_size', type: 'number', field: 'fontSize', min: 8, max: 200, step: 1 },
];
const visibleControls = computed(() =>
  styleControls.filter((control) => {
    switch (control.id) {
      case 'size':
        return activeKind.value !== 'text';
      case 'fill':
        return activeKind.value === 'rectangle' || activeKind.value === 'circle';
      case 'text':
      case 'font_size':
        return activeKind.value === 'text';
      default:
        return true;
    }
  }),
);

function numericLabel(control: NumericControl) {
  const value = annotationStyle.value[control.field];
  if (control.field === 'opacity') {
    return `${number(value * 100)}%`;
  }
  return number(value);
}

function setNumber(
  field: keyof Pick<AnnotationStyle, 'size' | 'opacity' | 'fontSize'>,
  event: Event,
) {
  const value = Number((event.target as HTMLInputElement).value);
  if (Number.isFinite(value)) {
    viewer.setAnnotationStyle({ [field]: value });
  }
}

onMounted(() => {
  if (!annotationTool.value) {
    viewer.setAnnotationTool('select');
  }
});
onBeforeUnmount(() => viewer.setAnnotationTool(null));

</script>

<template>
  <section class="annotation_controls" :aria-label="t('annotations.title')">
    <fieldset
      v-for="group in buttonGroups"
      :key="group.className"
      :class="group.className"
      :aria-label="t(`annotations.${group.label}`)"
    >
      <button
        v-for="button in group.buttons"
        :key="button.id"
        :class="button.className"
        :data-testid="`annotation_${button.id}`"
        :aria-label="t(`annotations.${button.label}`)"
        :title="t(`annotations.${button.label}`)"
        :aria-pressed="button.pressed?.()"
        :disabled="button.disabled()"
        @click="button.run()"
      >
        <span
          class="icon"
          :style="{ '--icon_url': `url(${button.icon})` }"
          aria-hidden="true"
        ></span>
      </button>
    </fieldset>

    <template v-if="annotationTool">
      <details>
        <summary>{{ t('annotations.help') }}</summary>
        <p class="hint">{{ t('annotations.hint') }}</p>
      </details>
      <fieldset :disabled="annotating || cropping">
        <template v-for="control in visibleControls" :key="control.id">
          <label v-if="control.type === 'checkbox'">
            <input
              :data-testid="`annotation_${control.id}`"
              type="checkbox"
              :checked="annotationStyle.filled"
              @change="
                viewer.setAnnotationStyle({ filled: ($event.target as HTMLInputElement).checked })
              "
            />
            {{ t(`annotations.${control.id}`) }}
          </label>
          <template v-else>
            <label :for="`annotation_${control.id}`">
              {{ t(`annotations.${control.id}`) }}
              <template v-if="control.type === 'range'">· {{ numericLabel(control) }}</template>
            </label>
            <input
              v-if="control.type === 'color'"
              :id="`annotation_${control.id}`"
              :data-testid="`annotation_${control.id}`"
              type="color"
              :value="annotationStyle.color"
              @change="
                viewer.setAnnotationStyle({ color: ($event.target as HTMLInputElement).value })
              "
            />
            <textarea
              v-else-if="control.type === 'text'"
              :id="`annotation_${control.id}`"
              :data-testid="`annotation_${control.id}`"
              rows="3"
              maxlength="2000"
              :value="annotationText"
              @change="viewer.setAnnotationText(($event.target as HTMLTextAreaElement).value)"
            ></textarea>
            <input
              v-else
              :id="`annotation_${control.id}`"
              :data-testid="`annotation_${control.id}`"
              :type="control.type"
              :min="control.min"
              :max="control.max"
              :step="control.step"
              :value="annotationStyle[control.field]"
              @change="setNumber(control.field, $event)"
            />
          </template>
        </template>
      </fieldset>
    </template>

    <output v-if="annotationLimit" class="hint">{{ t('annotations.limit') }}</output>
  </section>
</template>

<style scoped lang="scss">

.annotation_controls,
fieldset {
  display: flex;
  flex-direction: column;
  gap: $space_2;
  min-width: 0;
}

fieldset {
  border: 0;
  margin: 0;
  padding: 0;
}

.hint {
  @extend %hint;
}

.annotation_toolbar,
.annotation_actions {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: $space_1;
}

.annotation_actions {
  padding-bottom: $space_2;
  border-bottom: $border_width solid var(--border);
}

.annotation_toolbar {
  justify-content: space-between;
}

.delete_action {
  margin-left: auto;
}

.annotation_toolbar button,
.annotation_actions button {
  @extend %icon_button;
  background: var(--surface-soft);
}

button[aria-pressed='true'] {
  @extend %selected_control;
}

summary {
  @extend %muted_label;
  cursor: pointer;
}

input[type='color'] {
  width: $control_size;
  height: $control_size;
  padding: $space_1;
}

input[type='range'] {
  width: 100%;
}

textarea {
  resize: vertical;
}

</style>
