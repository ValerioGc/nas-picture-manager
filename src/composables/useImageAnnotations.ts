import { computed, ref, shallowRef, watch } from 'vue';
import type { AnnotationStyle, AnnotationTool, ImageAnnotation } from '@/types/types';

export const MAX_ANNOTATIONS = 200;
export const MAX_ANNOTATION_POINTS = 20000;
const MAX_HISTORY = 50;

export function copyAnnotations(annotations: readonly ImageAnnotation[]): ImageAnnotation[] {
  return annotations.map((annotation) => ({
    ...annotation,
    style: { ...annotation.style },
    points: annotation.points.map((point) => ({ ...point })),
  }));
}

/**
 * Provides reactive state and functions for managing image annotations on an image.
 * @returns An object containing reactive references and functions for managing image annotations.
 */
export function useImageAnnotations() {
  const annotations = shallowRef<ImageAnnotation[]>([]);
  const annotationSnapshot = ref('[]');
  const annotationTool = ref<AnnotationTool | null>(null);
  const annotationSelection = ref<number | null>(null);
  const annotationStyle = ref<AnnotationStyle>({
    color: '#ff0000',
    size: 4,
    opacity: 1,
    filled: false,
    fontSize: 24,
  });
  const annotationText = ref('');
  const undoHistory = shallowRef<ImageAnnotation[][]>([]);
  const redoHistory = shallowRef<ImageAnnotation[][]>([]);
  const annotating = ref(false);
  let previous: ImageAnnotation[] | null = null;
  let previousSnapshot = '[]';
  let nextId = 1;

  watch(
    annotations,
    () => {
      if (!annotating.value) {
        annotationSnapshot.value = JSON.stringify(annotations.value);
      }
    },
    { flush: 'sync' },
  );

  const selectedAnnotation = computed(() =>
    annotations.value.find(({ id }) => id === annotationSelection.value),
  );

  const canUndoAnnotation = computed(() => undoHistory.value.length > 0);
  const canRedoAnnotation = computed(() => redoHistory.value.length > 0);
  const annotationLimit = computed(
    () =>
      annotations.value.length >= MAX_ANNOTATIONS ||
      annotations.value.reduce((count, item) => count + item.points.length, 0) >=
        MAX_ANNOTATION_POINTS,
  );

  function beginAnnotation() {
    if (!annotating.value) {
      previous = annotations.value;
      previousSnapshot = JSON.stringify(previous);
      annotating.value = true;
    }
  }

  function finishAnnotation(cancel = false) {
    if (previous) {
      if (cancel) {
        annotations.value = previous;
        annotationSnapshot.value = previousSnapshot;
      } else {
        const snapshot = JSON.stringify(annotations.value);
        if (previousSnapshot !== snapshot) {
          undoHistory.value = [...undoHistory.value.slice(-(MAX_HISTORY - 1)), previous];
          redoHistory.value = [];
        }

        annotationSnapshot.value = snapshot;
      }
    }
    previous = null;
    annotating.value = false;
    if (!selectedAnnotation.value) {
      annotationSelection.value = null;
    }
  }

  function setAnnotationTool(tool: AnnotationTool | null) {
    finishAnnotation(true);
    annotationTool.value = tool;
    annotationSelection.value = null;
    if (tool === 'highlight') {
      annotationStyle.value = { ...annotationStyle.value, opacity: 0.35, size: 20 };
    } else if (tool === 'pen') {
      annotationStyle.value = { ...annotationStyle.value, opacity: 1, size: 4 };
    }
  }

  function selectAnnotation(id: number | null) {
    annotationSelection.value = id;
    if (selectedAnnotation.value) {
      annotationStyle.value = { ...selectedAnnotation.value.style };
      annotationText.value = selectedAnnotation.value.text;
    }
  }

  function addAnnotation(annotation: Omit<ImageAnnotation, 'id'>) {
    if (annotationLimit.value) {
      return null;
    }

    const id = nextId++;
    annotations.value = [
      ...annotations.value,
      {
        ...annotation,
        id,
        style: { ...annotation.style },
        points: annotation.points.map((point) => ({ ...point })),
      },
    ];

    selectAnnotation(id);
    return id;
  }

  function updateAnnotation(id: number, changes: Partial<Omit<ImageAnnotation, 'id'>>) {
    annotations.value = annotations.value.map((item) =>
      item.id === id
        ? {
            ...item,
            ...changes,
            style: changes.style ? { ...changes.style } : item.style,
            points: changes.points ? changes.points.map((point) => ({ ...point })) : item.points,
          }
        : item,
    );
  }

  function setAnnotationStyle(changes: Partial<AnnotationStyle>) {
    const style = { ...annotationStyle.value, ...changes };
    annotationStyle.value = {
      ...style,
      color: /^#[0-9a-f]{6}$/i.test(style.color) ? style.color : annotationStyle.value.color,
      size: Math.min(100, Math.max(1, Number.isFinite(style.size) ? style.size : 4)),
      opacity: Math.min(1, Math.max(0.05, Number.isFinite(style.opacity) ? style.opacity : 1)),
      fontSize: Math.min(200, Math.max(8, Number.isFinite(style.fontSize) ? style.fontSize : 24)),
    };

    if (selectedAnnotation.value) {
      beginAnnotation();
      updateAnnotation(selectedAnnotation.value.id, { style: { ...annotationStyle.value } });
      finishAnnotation();
    }
  }

  function setAnnotationText(text: string) {
    annotationText.value = text.slice(0, 2000);
    if (selectedAnnotation.value?.kind === 'text') {
      beginAnnotation();
      updateAnnotation(selectedAnnotation.value.id, { text: annotationText.value });
      finishAnnotation();
    }
  }

  function removeAnnotation() {
    if (annotationSelection.value === null) {
      return;
    }

    beginAnnotation();
    annotations.value = annotations.value.filter(({ id }) => id !== annotationSelection.value);
    finishAnnotation();
  }

  function travelHistory(undo: boolean) {
    finishAnnotation(true);
    const from = undo ? undoHistory : redoHistory;
    const to = undo ? redoHistory : undoHistory;
    const next = from.value.at(-1);

    if (next) {
      to.value = [...to.value, annotations.value];
      from.value = from.value.slice(0, -1);
      annotations.value = next;
      annotationSnapshot.value = JSON.stringify(next);
      annotationSelection.value = null;
    }
  }

  function resetAnnotations() {
    finishAnnotation(true);
    annotations.value = [];
    annotationSnapshot.value = '[]';
    annotationSelection.value = null;
    annotationTool.value = null;
    annotationText.value = '';
    undoHistory.value = [];
    redoHistory.value = [];
  }

  return {
    annotations,
    annotationSnapshot,
    annotationTool,
    annotationSelection,
    annotationStyle,
    annotationText,
    selectedAnnotation,
    canUndoAnnotation,
    canRedoAnnotation,
    annotationLimit,
    annotating,
    beginAnnotation,
    finishAnnotation,
    setAnnotationTool,
    selectAnnotation,
    addAnnotation,
    updateAnnotation,
    setAnnotationStyle,
    setAnnotationText,
    removeAnnotation,
    undoAnnotation: () => travelHistory(true),
    redoAnnotation: () => travelHistory(false),
    resetAnnotations,
  };
}
