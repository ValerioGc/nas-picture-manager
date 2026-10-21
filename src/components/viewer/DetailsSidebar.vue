<script setup lang="ts">

import { computed } from 'vue';
import { useI18n } from '@/i18n';
import { useViewerStore } from '@/stores/viewerStore';
import { storeToRefs } from 'pinia';

const viewer = useViewerStore();
const { info, entries, index } = storeToRefs(viewer);

const { t, number, date } = useI18n();

const rows = computed(() =>
  info.value
    ? [
        {
          label: t('info.dimensions'),
          value: `${number(info.value.width)} × ${number(info.value.height)}`,
        },
        { label: t('info.format'), value: info.value.format },
        { label: t('info.alpha'), value: t(info.value.hasAlpha ? 'info.yes' : 'info.no') },
        {
          label: t('info.size'),
          value: number(info.value.size / 1024, {
            style: 'unit',
            unit: 'kilobyte',
            maximumFractionDigits: 1,
          }),
        },
      ]
    : [],
);

</script>

<template>
  <p v-if="!info" class="empty_details">{{ t('panel.empty') }}</p>

  <template v-else>
    <dl class="card">
      <div>
        <dt>{{ t('info.file') }}</dt>
        <dd>{{ info.name }}</dd>
      </div>
      <div>
        <dt>{{ t('info.folder') }}</dt>
        <dd>{{ info.folder || t('info.unknown') }}</dd>
      </div>
    </dl>
    <dl class="card">
      <div v-for="row in rows" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>
    <dl class="card">
      <div>
        <dt>{{ t('info.created') }}</dt>
        <dd>{{ date(info.created) }}</dd>
      </div>
      <div>
        <dt>{{ t('info.modified') }}</dt>
        <dd>{{ date(info.modified) }}</dd>
      </div>
    </dl>

    <p v-if="!entries[index]?.source" class="hint">{{ t('info.browser') }}</p>
    <p v-if="['GIF', 'TIFF', 'TIF'].includes(info.format)" class="hint">{{ t('viewer.static') }}</p>
  </template>
</template>

<style scoped lang="scss">

.card {
  background: var(--surface-soft);
  border-radius: $radius_medium;
  overflow: hidden;

  div {
    padding: $space_4;

    + div {
      border-top: $border_width solid var(--border);
    }
  }
}

dt {
  @extend %muted_label;
  margin-bottom: $space_2;
}

dd {
  overflow-wrap: anywhere;
  line-height: 1.5;
}

.hint,
.empty_details {
  @extend %hint;
}

</style>
