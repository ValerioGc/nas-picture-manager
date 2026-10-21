import { defineStore } from 'pinia';
import { computed, onScopeDispose, ref } from 'vue';
import { useImageEditor } from '@/composables/useImageEditor';
import { useImageViewer } from '@/composables/useImageViewer';
import { useGlobalStore } from '@/stores/globalStore';
import type { PickedFile, Sidebar, Zoom } from '@/types/types';

export const useViewerStore = defineStore('viewer', () => {
  const global = useGlobalStore();
  const viewer = useImageViewer();
  const entry = computed(() => viewer.entries.value[viewer.index.value]);
  const editor = useImageEditor(entry, viewer.info);
  const displayedInfo = computed(() => editor.renderedInfo.value ?? viewer.info.value);
  const displayedPreview = computed(() => editor.preview.value || viewer.preview.value);
  const imageReady = computed(
    () => Boolean(viewer.info.value && displayedPreview.value) && !viewer.loading.value,
  );

  const zoom = ref<Zoom>('fit');

  const leaveConfirmation = ref(false);
  const leaveContext = ref<'image' | 'panel'>('image');
  let resolveLeave: ((leave: boolean) => void) | undefined;

  function confirmLeave(leave: boolean) {
    const confirmed = leave && !editor.saving.value;
    if (confirmed && resolveLeave && leaveContext.value === 'panel') {
      editor.reset();
    }
    leaveConfirmation.value = false;
    resolveLeave?.(confirmed);
    resolveLeave = undefined;
  }

  onScopeDispose(() => confirmLeave(false));

  async function canLeave(context: 'image' | 'panel' = 'image') {
    if (editor.saving.value || leaveConfirmation.value) {
      return false;
    }
    if (!editor.unsaved.value) {
      return true;
    }
    leaveContext.value = context;
    leaveConfirmation.value = true;
    return new Promise<boolean>((resolve) => {
      resolveLeave = resolve;
    });
  }

  async function navigate(direction: number) {
    const next = viewer.index.value + direction;
    if (next >= 0 && next < viewer.entries.value.length && (await canLeave())) {
      viewer.navigate(direction);
    }
  }

  async function selectFiles(files: (File | PickedFile)[]) {
    if (await canLeave()) {
      await viewer.selectFiles(files);
      if (files.length) {
        zoom.value = 'fit';
      }
    }
  }

  async function togglePanel(panel: Sidebar) {
    if (panel && !imageReady.value) {
      return;
    }
    if (global.panel === 'edit' && !(await canLeave('panel'))) {
      return;
    }
    global.toggle_panel(panel, imageReady.value);
  }

  async function closePanel() {
    if (global.panel === 'edit' && !(await canLeave('panel'))) {
      return;
    }
    return global.close_panel();
  }

  function setAnnotationTool(tool: Parameters<typeof editor.setAnnotationTool>[0]) {
    if (tool === null || (imageReady.value && !editor.saving.value && !editor.cropping.value)) {
      editor.setAnnotationTool(tool);
    }
  }

  return {
    annotations: editor.annotations,
    annotationTool: editor.annotationTool,
    annotationStyle: editor.annotationStyle,
    annotationText: editor.annotationText,
    selectedAnnotation: editor.selectedAnnotation,
    canUndoAnnotation: editor.canUndoAnnotation,
    canRedoAnnotation: editor.canRedoAnnotation,
    annotationLimit: editor.annotationLimit,
    annotating: editor.annotating,
    beginAnnotation: editor.beginAnnotation,
    finishAnnotation: editor.finishAnnotation,
    setAnnotationTool,
    selectAnnotation: editor.selectAnnotation,
    addAnnotation: editor.addAnnotation,
    updateAnnotation: editor.updateAnnotation,
    setAnnotationStyle: editor.setAnnotationStyle,
    setAnnotationText: editor.setAnnotationText,
    removeAnnotation: editor.removeAnnotation,
    undoAnnotation: editor.undoAnnotation,
    redoAnnotation: editor.redoAnnotation,
    entries: viewer.entries,
    index: viewer.index,
    info: viewer.info,
    preview: viewer.preview,
    loading: viewer.loading,
    error: viewer.error,
    currentName: viewer.currentName,
    edits: editor.edits,
    processing: editor.processing,
    saving: editor.saving,
    editError: editor.error,
    savedName: editor.savedName,
    unsaved: editor.unsaved,
    cropping: editor.cropping,
    crop: editor.crop,
    cropRatio: editor.cropRatio,
    format: editor.format,
    exportFormat: editor.exportFormat,
    dimensions: editor.dimensions,
    validCrop: editor.validCrop,
    displayedInfo,
    displayedPreview,
    imageReady,
    zoom,
    leaveConfirmation,
    leaveContext,
    confirmLeave,
    canLeave,
    navigate,
    selectFiles,
    togglePanel,
    closePanel,
    reset: editor.reset,
    startCrop: editor.startCrop,
    applyCrop: editor.applyCrop,
    setRatio: editor.setRatio,
    save: editor.save,
  };
});
