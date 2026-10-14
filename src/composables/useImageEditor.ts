import { computed, onScopeDispose, ref, watch, type Ref } from 'vue';
import { copyAnnotations, useImageAnnotations } from '@/composables/useImageAnnotations';
import { rasterizeAnnotations } from '@/services/annotations';
import { previewBlob } from '@/services/imageDocument';
import { imageError, renderImage, saveImage } from '@/composables/imageClient';
import type {
  CropRectangle,
  ExportFormat,
  ImageEdits,
  ImageEntry,
  ImageErrorCode,
  ImageInfo,
} from '@/types/types';

export function defaultEdits(): ImageEdits {
  return {
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
    brightness: 0,
    contrast: 0,
    sharpness: 0,
    crop: null,
  };
}

export function useImageEditor(
  entry: Readonly<Ref<ImageEntry | undefined>>,
  original: Readonly<Ref<ImageInfo | null>>,
) {
  const annotationEditor = useImageAnnotations();
  const edits = ref(defaultEdits());
  const preview = ref('');
  const renderedInfo = ref<ImageInfo | null>(null);
  const processing = ref(false);
  const saving = ref(false);
  const error = ref<ImageErrorCode | null>(null);
  const savedName = ref('');
  const snapshot = () => JSON.stringify(edits.value) + annotationEditor.annotationSnapshot.value;
  const savedEdits = ref(snapshot());
  const cropping = ref(false);
  const crop = ref<CropRectangle>({ x: 0, y: 0, width: 1, height: 1 });
  const cropRatio = ref('free');
  const format = ref<ExportFormat | 'original'>('png');
  const originalFormat = computed<ExportFormat | null>(() => {
    const sourceFormat = original.value?.format.toLowerCase();
    if (sourceFormat === 'jpg' || sourceFormat === 'jpeg') {
      return 'jpeg';
    }
    if (sourceFormat === 'tif' || sourceFormat === 'tiff') {
      return 'tiff';
    }
    return sourceFormat === 'png' ||
      sourceFormat === 'webp' ||
      sourceFormat === 'gif' ||
      sourceFormat === 'bmp' ||
      sourceFormat === 'ico'
      ? sourceFormat
      : null;
  });
  const exportFormat = computed(() =>
    format.value === 'original' ? (originalFormat.value ?? 'png') : format.value,
  );

  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let generation = 0;

  const dirty = computed(
    () =>
      annotationEditor.annotations.value.length > 0 ||
      JSON.stringify(edits.value) !== JSON.stringify(defaultEdits()),
  );

  const unsaved = computed(
    () => snapshot() !== savedEdits.value || cropping.value || annotationEditor.annotating.value,
  );

  const dimensions = computed(() => {
    const width = original.value?.width ?? 0;
    const height = original.value?.height ?? 0;
    return edits.value.rotation % 2 ? { width: height, height: width } : { width, height };
  });

  const validCrop = computed(
    () =>
      [crop.value.x, crop.value.y, crop.value.width, crop.value.height].every(Number.isInteger) &&
      crop.value.x >= 0 &&
      crop.value.y >= 0 &&
      crop.value.width > 0 &&
      crop.value.height > 0 &&
      crop.value.x + crop.value.width <= dimensions.value.width &&
      crop.value.y + crop.value.height <= dimensions.value.height,
  );

  const effectiveEdits = computed(() => ({
    ...edits.value,
    crop: cropping.value ? null : edits.value.crop,
  }));

  function releasePreview() {
    if (preview.value) {
      URL.revokeObjectURL(preview.value);
    }
    preview.value = '';
    renderedInfo.value = null;
  }

  function cancelRequest() {
    generation++;
    clearTimeout(timer);
    controller?.abort();
    processing.value = false;
  }

  function reset() {
    cancelRequest();
    cropping.value = false;
    annotationEditor.resetAnnotations();
    cropRatio.value = 'free';
    edits.value = defaultEdits();
    savedEdits.value = snapshot();
    savedName.value = '';
    error.value = null;
    releasePreview();
  }

  function startCrop() {
    if (!original.value || processing.value || saving.value) {
      return;
    }

    annotationEditor.setAnnotationTool(null);
    crop.value = edits.value.crop ? { ...edits.value.crop } : { x: 0, y: 0, ...dimensions.value };
    cropping.value = true;
  }

  function applyCrop() {
    if (!validCrop.value) {
      return;
    }

    edits.value = { ...edits.value, crop: { ...crop.value } };
    cropping.value = false;
  }

  function setRatio(ratio: string) {
    cropRatio.value = ratio;
    if (ratio === 'free') {
      return;
    }

    const [width, height] = ratio.split(':').map(Number);
    if (!width || !height) {
      return;
    }

    const targetWidth = Math.min(
      dimensions.value.width,
      Math.floor((dimensions.value.height * width) / height),
    );

    const targetHeight = Math.floor((targetWidth * height) / width);
    crop.value = {
      x: Math.floor((dimensions.value.width - targetWidth) / 2),
      y: Math.floor((dimensions.value.height - targetHeight) / 2),
      width: targetWidth,
      height: targetHeight,
    };
  }

  watch(
    annotationEditor.annotations,
    () => {
      savedName.value = '';
      error.value = null;
    },
    { flush: 'sync' },
  );

  watch(entry, reset, { flush: 'sync' });

  watch(
    original,
    () => {
      const sourceFormat = originalFormat.value;
      let selectedFormat: ExportFormat | 'original' = sourceFormat ? 'original' : 'png';
      if (sourceFormat === 'png' || sourceFormat === 'jpeg' || sourceFormat === 'webp') {
        selectedFormat = sourceFormat;
      }
      format.value = selectedFormat;
    },
    { immediate: true, flush: 'sync' },
  );

  watch(
    [effectiveEdits, original],
    () => {
      cancelRequest();
      error.value = null;
      savedName.value = '';
      if (
        !entry.value ||
        !original.value ||
        JSON.stringify(effectiveEdits.value) === JSON.stringify(defaultEdits())
      ) {
        releasePreview();
        return;
      }

      processing.value = true;
      const request = generation;
      const selected = entry.value;
      const sourceInfo = { ...original.value };
      const settings = structuredClone(
        effectiveEdits.value.crop
          ? { ...effectiveEdits.value, crop: { ...effectiveEdits.value.crop } }
          : { ...effectiveEdits.value },
      );

      timer = setTimeout(async () => {
        controller = new AbortController();
        try {
          const document = await renderImage(selected, settings, controller.signal);
          if (request !== generation) {
            return;
          }

          releasePreview();
          preview.value = URL.createObjectURL(previewBlob(document));

          renderedInfo.value = {
            ...sourceInfo,
            width: document.info.width,
            height: document.info.height,
          };
        } catch (cause: unknown) {
          if (request === generation) {
            error.value = imageError(cause);
          }
        } finally {
          if (request === generation) {
            processing.value = false;
          }
        }
      }, 180);
    },
    { deep: true, flush: 'sync' },
  );

  async function save() {
    if (
      !entry.value ||
      !original.value ||
      processing.value ||
      saving.value ||
      cropping.value ||
      annotationEditor.annotating.value
    ) {
      return;
    }

    saving.value = true;
    error.value = null;
    savedName.value = '';
    const selected = entry.value;
    const targetFormat = exportFormat.value;
    const annotations = copyAnnotations(annotationEditor.annotations.value);
    const sourceSize = { width: original.value.width, height: original.value.height };
    const settings: ImageEdits = {
      ...edits.value,
      crop: edits.value.crop ? { ...edits.value.crop } : null,
    };

    try {
      const overlay = await rasterizeAnnotations(annotations, sourceSize, settings);
      const name = overlay
        ? await saveImage(selected, settings, targetFormat, overlay)
        : await saveImage(selected, settings, targetFormat);
      if (name && selected === entry.value) {
        savedName.value = name;
        savedEdits.value = JSON.stringify(settings) + JSON.stringify(annotations);
      }
    } catch (cause: unknown) {
      if (selected === entry.value) {
        error.value = imageError(cause);
      }
    } finally {
      saving.value = false;
    }
  }

  onScopeDispose(() => {
    cancelRequest();
    releasePreview();
  });

  return {
    ...annotationEditor,
    edits,
    preview,
    renderedInfo,
    processing,
    saving,
    error,
    savedName,
    dirty,
    unsaved,
    cropping,
    crop,
    cropRatio,
    format,
    originalFormat,
    exportFormat,
    dimensions,
    validCrop,
    reset,
    startCrop,
    applyCrop,
    setRatio,
    save,
  };
}
