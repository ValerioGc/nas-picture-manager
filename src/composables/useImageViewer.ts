import { computed, onScopeDispose, ref } from 'vue';
import { platform } from '@/services/imageService';
import { imageError } from '@/composables/imageErrors';
import { previewBlob } from '@/services/imageDocument';
import type { ImageEntry, ImageErrorCode, ImageInfo, PickedFile } from '@/types/types';

export const imageAccept = '.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,.ico';

export function useImageViewer() {
  const entries = ref<ImageEntry[]>([]);
  const index = ref(0);
  const info = ref<ImageInfo | null>(null);
  const preview = ref('');
  const loading = ref(false);
  const error = ref<ImageErrorCode | null>(null);
  let sequence = 0;
  let controller: AbortController | undefined;
  const currentName = computed(() => entries.value[index.value]?.name ?? '');

  function clearPreview() {
    if (preview.value) {
      URL.revokeObjectURL(preview.value);
    }

    preview.value = '';
    info.value = null;
  }

  async function load(next: number) {
    const entry = entries.value[next];
    if (!entry) {
      return;
    }

    const request = ++sequence;
    controller?.abort();
    controller = new AbortController();
    index.value = next;
    loading.value = true;
    error.value = null;
    clearPreview();
    try {
      const document = await platform.inspectImage(entry, controller.signal);
      if (request !== sequence) {
        return;
      }

      info.value = document.info;
      preview.value = URL.createObjectURL(previewBlob(document));
    } catch (cause: unknown) {
      if (request === sequence) {
        error.value = imageError(cause);
      }
    } finally {
      if (request === sequence) {
        loading.value = false;
      }
    }
  }

  async function selectFiles(files: (File | PickedFile)[]) {
    if (!files.length) {
      return;
    }
    if (files.length > 500) {
      error.value = 'too_many_files';
      return;
    }
    entries.value = files.map((file, id) =>
      file instanceof File ? { id, name: file.name, file } : { id, name: file.name, source: file },
    );
    await load(0);
  }

  function navigate(direction: number) {
    const next = index.value + direction;
    if (next >= 0 && next < entries.value.length) {
      void load(next);
    }
  }

  onScopeDispose(() => {
    sequence++;
    controller?.abort();
    clearPreview();
  });

  return {
    entries,
    index,
    info,
    preview,
    loading,
    error,
    currentName,
    selectFiles,
    navigate,
  };
}
