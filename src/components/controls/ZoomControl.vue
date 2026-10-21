<script setup lang="ts">

import { computed, ref } from 'vue';
import { usePopup } from '@/composables/usePopup';
import type { Zoom } from '@/types/types';
import { useI18n } from '@/i18n';

import checkIcon from '@/assets/icons/check.svg?no-inline';
import downIcon from '@/assets/icons/down.svg?no-inline';
import zoomIcon from '@/assets/icons/zoom.svg?no-inline';

const zoom = defineModel<Zoom>({ required: true });
const { t, number } = useI18n();

const { expanded: open, root, trigger, close } = usePopup();
const custom = ref(100);
const invalid = ref(false);

const label = computed(() =>
  zoom.value === 'fit' ? t('zoom.fit') : number(zoom.value / 100, { style: 'percent' }),
);

function select(value: Zoom) {
  zoom.value = value;
  open.value = false;
  invalid.value = false;
  trigger.value?.focus();
}

function apply() {
  const value = Number(custom.value);
  if (!Number.isFinite(value) || value < 10 || value > 400) {
    invalid.value = true;
    return;
  }

  select(value);
}

</script>

<template>
  <div ref="root" class="zoom_control" @keydown.esc.stop="close(true)">
    <button
      ref="trigger"
      class="zoom_trigger"
      data-testid="zoom_toggle"
      :aria-label="`${t('zoom.label')}: ${label}`"
      :aria-expanded="open"
      aria-controls="zoom_options"
      @click="
        open = !open;
        custom = zoom === 'fit' ? 100 : zoom;
      "
    >
      <span class="icon" :style="{ '--icon_url': `url(${zoomIcon})` }" aria-hidden="true"></span>
      <span>{{ label }}</span>
      <span class="icon" :style="{ '--icon_url': `url(${downIcon})` }" aria-hidden="true"></span>
    </button>

    <div v-if="open" id="zoom_options" class="zoom_menu" :aria-label="t('zoom.label')">
      <button data-testid="zoom_fit" :aria-pressed="zoom === 'fit'" @click="select('fit')">
        {{ t('zoom.fit') }}
        <span
          v-if="zoom === 'fit'"
          class="icon"
          :style="{ '--icon_url': `url(${checkIcon})` }"
          aria-hidden="true"
        ></span>
      </button>
      <button
        v-for="value in [300, 200, 100, 66, 50]"
        :key="value"
        :data-testid="`zoom_${value}`"
        :aria-pressed="zoom === value"
        @click="select(value)"
      >
        <span>{{ number(value / 100, { style: 'percent' }) }}</span>
        <kbd v-if="value >= 100">{{ `Ctrl+${value / 100}` }}</kbd>
      </button>

      <form @submit.prevent="apply">
        <label for="custom_zoom">{{ t('zoom.custom') }}</label>
        <div>
          <input
            id="custom_zoom"
            v-model="custom"
            data-testid="zoom_custom"
            type="number"
            min="10"
            max="400"
            step="1"
            :aria-invalid="invalid"
          />

          <button type="submit" :aria-label="t('zoom.apply')">
            <span
              class="icon"
              :style="{ '--icon_url': `url(${checkIcon})` }"
              aria-hidden="true"
            ></span>
          </button>
        </div>
        <p v-if="invalid" role="alert">{{ t('zoom.invalid') }}</p>
      </form>
    </div>
  </div>
</template>

<style scoped lang="scss">

.zoom_control {
  position: relative;
  z-index: 2;
}

.zoom_trigger {
  display: flex;
  align-items: center;
  gap: $space_3;
  height: $footer_control_height;
  padding: 0 $space_4;
  white-space: nowrap;
  background: var(--surface);
  border: $border_width solid var(--border);
  border-radius: $radius_medium;
}

.zoom_menu {
  position: absolute;
  bottom: calc(100% + $space_2);
  right: 0;
  width: $menu_width;
  padding: $space_2;
  background: var(--surface);
  border: $border_width solid var(--border);
  box-shadow: $shadow_popup;
  border-radius: $radius_medium;

  > button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: $space_3;
    text-align: left;
  }
}

button[aria-pressed='true'] {
  @extend %selected_control;
}

kbd {
  font-family: inherit;
  @extend %muted_label;
}

form {
  display: grid;
  gap: $space_2;
  padding: $space_3;
  border-top: $border_width solid var(--border);

  div {
    display: flex;
    gap: $space_2;
  }

  button {
    width: $control_size;
    display: grid;
    place-items: center;
  }
}

input {
  width: 100%;
  min-width: 0;
}

label,
p {
  font-size: $font_small;
  color: var(--muted);
}

</style>
