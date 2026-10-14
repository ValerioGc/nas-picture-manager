<script setup lang="ts">

import { useI18n } from '@/i18n';
import { useGlobalStore } from '@/stores/globalStore';
import { storeToRefs } from 'pinia';

import closeIcon from '@/assets/icons/close.svg?no-inline';
import EditSidebar from '@/components/editor/EditSidebar.vue';
import DetailsSidebar from '@/components/viewer/DetailsSidebar.vue';

const { panel } = storeToRefs(useGlobalStore());
const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();

</script>

<template>
  <aside
    class="sidebar"
    data-testid="image_sidebar"
    :aria-label="t(panel === 'info' ? 'panel.info' : 'panel.edit')"
  >
    <header>
      <h2>{{ t(panel === 'info' ? 'panel.info' : 'panel.edit') }}</h2>
      <button :aria-label="t('panel.close')" data-testid="panel_close" @click="emit('close')">
        <span class="icon" :style="{ '--icon_url': `url(${closeIcon})` }" aria-hidden="true"></span>
      </button>
    </header>

    <div class="panel_content" :class="{ panel_content_edit: panel === 'edit' }">
      <DetailsSidebar v-if="panel === 'info'" />
      <EditSidebar v-else />
    </div>
  </aside>
</template>

<style scoped lang="scss">

.sidebar {
  display: flex;
  flex-direction: column;
  width: $panel_width;
  flex: 0 0 $panel_width;
  min-height: 0;
  background: var(--surface);
  border-left: $border_width solid var(--border);
  overflow: hidden;
}

header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $space_5 $space_5 $space_3;

  header button {
    @extend %icon_button;
  }
}

h2 {
  font-size: $font_title;
  font-weight: 600;
}

.panel_content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: $space_5;
  padding: $space_3 $space_5 $space_6;

  &_edit {
    overflow: hidden;
  }
}

@media (max-width: $breakpoint_compact) {
  .sidebar {
    position: absolute;
    z-index: 3;
    right: 0;
    top: 0;
    bottom: 0;
    max-width: 90%;
    box-shadow: $shadow_popup;
  }
}

</style>
