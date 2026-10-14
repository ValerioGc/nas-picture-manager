<script setup lang="ts">

import { usePopup } from '@/composables/usePopup';

import downIcon from '@/assets/icons/down.svg?no-inline';
import moreIcon from '@/assets/icons/more.svg?no-inline';
import openIcon from '@/assets/icons/open.svg?no-inline';

import { useI18n } from '@/i18n';

const emit = defineEmits<{ open: [] }>();

const { t } = useI18n();
const { expanded: menu_open, root, trigger, close } = usePopup();

function open() {
  emit('open');
  close();
}

</script>

<template>
  <div ref="root" class="options" @keydown.esc.stop="close(true)">
    <button
      ref="trigger"
      class="trigger"
      data-testid="options_toggle"
      :aria-label="t('options.title')"
      :title="t('options.title')"
      :aria-expanded="menu_open"
      aria-controls="viewer_options"
      @click="menu_open = !menu_open"
    >
      <span class="icon" :style="{ '--icon_url': `url(${moreIcon})` }" aria-hidden="true"></span>
    </button>
    <div v-if="menu_open" id="viewer_options" class="options_menu" :aria-label="t('options.title')">
      <button class="action" data-testid="options_open" @click="open">
        <span class="icon" :style="{ '--icon_url': `url(${openIcon})` }" aria-hidden="true"></span>
        <span>{{ t('viewer.open') }}</span>
        <kbd>Ctrl+O</kbd>
      </button>

      <details class="section shortcuts" data-testid="shortcuts_section">
        <summary data-testid="shortcuts_toggle">
          <span>{{ t('options.shortcuts') }}</span>
          <span
            class="icon"
            :style="{ '--icon_url': `url(${downIcon})` }"
            aria-hidden="true"
          ></span>
        </summary>
        <div>
          <span>{{ t('options.navigation') }}</span>
          <kbd>← →</kbd>
        </div>
        <div>
          <span>{{ t('panel.info') }}</span>
          <kbd>I</kbd>
        </div>
        <div>
          <span>{{ t('panel.edit') }}</span>
          <kbd>E</kbd>
        </div>
        <div>
          <span>{{ t('options.dismiss') }}</span>
          <kbd>Esc</kbd>
        </div>
      </details>
    </div>
  </div>
</template>

<style scoped lang="scss">

.options {
  position: relative;
}

.trigger {
  @extend %icon_button;
}

.trigger[aria-expanded='true'] {
  background: var(--surface-soft);
}

.options_menu {
  position: absolute;
  top: calc(100% + $space_3);
  right: 0;
  width: $menu_width;
  max-height: calc(100dvh - $toolbar_height);
  overflow: auto;
  @extend %popup_surface;
}

.action {
  @extend %menu_action;
}

kbd {
  @extend %shortcut_key;
}

.section {
  @extend %menu_section;
}

.shortcuts {
  summary {
    @extend %fx_between_center;
    gap: $space_3;
    cursor: pointer;
    list-style: none;

    ::-webkit-details-marker {
      display: none;
    }

    &:hover {
      color: var(--accent);
    }

    .icon {
      transform: rotate(-90deg);
      transition: transform $duration_fast;
    }
  }

  div {
    display: flex;
    gap: $space_3;
    font-size: $font_small;
  }
}

.shortcuts[open] summary .icon {
  transform: rotate(0);
}

</style>
