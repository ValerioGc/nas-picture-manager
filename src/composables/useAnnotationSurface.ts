import { computed, onBeforeUnmount, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useViewerStore } from '@/stores/viewerStore';
import { useGlobalStore } from '@/stores/globalStore';
import { MAX_ANNOTATION_POINTS } from '@/composables/useImageAnnotations';
import { useAnnotationCanvas } from '@/composables/useAnnotationCanvas';
import { annotationPoint } from '@/services/annotations';
import {
  moveAnnotation,
  resizeAnnotation,
  resizeTextAnnotation,
  resizeWithKeyboard,
} from '@/utils/annotationGeometry';
import { useI18n } from '@/i18n';
import type { ImageAnnotation, ImagePoint } from '@/types/types';

interface Gesture {
  origin: ImagePoint;
  item: ImageAnnotation;
  mode: 'draw' | 'move' | 'resize';
  pointerId: number;
}

export function useAnnotationSurface() {
  const viewer = useViewerStore();
  const global = useGlobalStore();
  const {
    annotations,
    annotationTool,
    selectedAnnotation,
    info,
    edits,
    cropping,
    processing,
    saving,
  } = storeToRefs(viewer);

  const { t } = useI18n();

  const interactive = computed(
    () =>
      global.panel === 'edit' &&
      annotationTool.value !== null &&
      !cropping.value &&
      !processing.value &&
      !saving.value,
  );

  const effectiveEdits = computed(() => ({
    ...edits.value,
    crop: cropping.value ? null : edits.value.crop,
  }));

  let gesture: Gesture | null = null;
  let pendingMoves: PointerEvent[] = [];
  const surface = useAnnotationCanvas(viewer, effectiveEdits, flushMoves);
  const { root, resizeHandle, draw, point, boundsFor, hitAt, scheduleDraw } = surface;

  function start(event: PointerEvent, resize = false) {
    if (!interactive.value || event.button !== 0 || gesture || !info.value) {
      return;
    }

    const origin = point(event);
    let item = selectedAnnotation.value;
    let mode: Gesture['mode'] = resize ? 'resize' : 'move';
    if (!resize) {
      item = hitAt(origin);

      if (item) {
        viewer.setAnnotationTool('select');
      }

      viewer.selectAnnotation(item?.id ?? null);
    }
    if (!resize && !item && annotationTool.value && annotationTool.value !== 'select') {
      if (viewer.annotationLimit) {
        return;
      }

      viewer.beginAnnotation();
      const id = viewer.addAnnotation({
        ...origin,
        kind: annotationTool.value,
        width: 0,
        height: 0,
        text: viewer.annotationText || t('annotations.default_text'),
        points: [{ x: 0, y: 0 }],
        style: { ...viewer.annotationStyle },
      });
      item = annotations.value.find((candidate) => candidate.id === id);
      mode = 'draw';
    }

    if (!item) {
      return;
    }

    viewer.beginAnnotation();
    gesture = {
      origin,
      item: {
        ...item,
        style: { ...item.style },
        points: item.points.map((value) => ({ ...value })),
      },
      mode,
      pointerId: event.pointerId,
    };

    root.value?.focus();
    root.value?.setPointerCapture(event.pointerId);
  }

  function applyMove(event: PointerEvent) {
    if (event.pointerId !== gesture?.pointerId || !info.value) {
      return;
    }
    const current = point(event);
    const { item, origin, mode } = gesture;
    if (mode === 'move') {
      const bounds = boundsFor(item);
      if (bounds) {
        viewer.updateAnnotation(
          item.id,
          moveAnnotation(item, bounds, info.value, {
            x: current.x - origin.x,
            y: current.y - origin.y,
          }),
        );
      }
      return;
    }
    if (['pen', 'highlight'].includes(item.kind)) {
      appendBrushPoint(item, current);
      return;
    }
    if (item.kind === 'text') {
      const bounds = boundsFor(item);
      if (mode === 'resize' && bounds) {
        viewer.updateAnnotation(item.id, resizeTextAnnotation(item, current, bounds));
      }
      return;
    }
    viewer.updateAnnotation(item.id, resizeAnnotation(item, current, event.shiftKey));
  }

  function appendBrushPoint(item: ImageAnnotation, current: ImagePoint) {
    const draft = annotations.value.find(({ id }) => id === item.id);
    const last = draft?.points.at(-1);
    if (!draft || !last || pointCount() >= MAX_ANNOTATION_POINTS) {
      return;
    }
    const next = { x: current.x - item.x, y: current.y - item.y };
    if (Math.hypot(next.x - last.x, next.y - last.y) >= 0.5) {
      viewer.updateAnnotation(item.id, { points: [...draft.points, next] });
    }
  }

  function pointCount() {
    return annotations.value.reduce((count, item) => count + item.points.length, 0);
  }

  function move(event: PointerEvent) {
    if (event.pointerId !== gesture?.pointerId) {
      return;
    }
    const brush = gesture.mode === 'draw' && ['pen', 'highlight'].includes(gesture.item.kind);
    if (!brush) {
      pendingMoves = [event];
    } else {
      const samples = event.getCoalescedEvents?.();
      pendingMoves.push(...(samples?.length ? samples : [event]));
      // Cap the samples kept between frames in case rendering stalls.
      if (pendingMoves.length > 512) {
        pendingMoves = pendingMoves.slice(-512);
      }
    }
    scheduleDraw();
  }

  function flushMoves() {
    const moves = pendingMoves;
    pendingMoves = [];
    if (!gesture || !moves.length || !info.value) {
      return;
    }
    const { item, mode } = gesture;
    if (mode !== 'draw' || !['pen', 'highlight'].includes(item.kind)) {
      applyMove(moves.at(-1)!);
      return;
    }
    const draft = annotations.value.find(({ id }) => id === item.id);
    if (!draft) {
      return;
    }
    const remaining = MAX_ANNOTATION_POINTS - pointCount();
    const additions: ImagePoint[] = [];
    let last = draft.points.at(-1)!;
    for (const event of moves) {
      if (additions.length >= remaining) {
        break;
      }
      const current = point(event);
      const next = { x: current.x - item.x, y: current.y - item.y };
      if (Math.hypot(next.x - last.x, next.y - last.y) >= 0.5) {
        additions.push(next);
        last = next;
      }
    }
    if (additions.length) {
      viewer.updateAnnotation(item.id, { points: [...draft.points, ...additions] });
    }
  }

  function finish(event?: PointerEvent, cancel = false) {
    if (!gesture || (event && event.pointerId !== gesture.pointerId)) {
      return;
    }
    if (event && !cancel) {
      flushMoves();
      applyMove(event);
    }
    pendingMoves = [];
    const { item, pointerId } = gesture;
    const draft = annotations.value.find(({ id }) => id === item.id);
    const empty =
      gesture.mode === 'draw' &&
      draft &&
      ['rectangle', 'circle', 'line'].includes(item.kind) &&
      Math.hypot(draft.width, draft.height) < 1;
    gesture = null;
    viewer.finishAnnotation(cancel || Boolean(empty));
    draw();
    if (root.value?.hasPointerCapture(pointerId)) {
      root.value.releasePointerCapture(pointerId);
    }
  }

  function keydown(event: KeyboardEvent) {
    const item = selectedAnnotation.value;
    const directions: Record<string, ImagePoint> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const direction = directions[event.key];
    if (!interactive.value || !item || !direction || !info.value || gesture) {
      return;
    }
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    const origin = annotationPoint({ x: 0, y: 0 }, info.value, effectiveEdits.value, true);
    const target = annotationPoint(
      { x: direction.x * step, y: direction.y * step },
      info.value,
      effectiveEdits.value,
      true,
    );
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const bounds = boundsFor(item);
    if (!bounds) {
      return;
    }
    const changes =
      event.target === resizeHandle.value
        ? resizeWithKeyboard(item, direction, step, dx, dy)
        : moveAnnotation(item, bounds, info.value, { x: dx, y: dy });
    viewer.beginAnnotation();
    viewer.updateAnnotation(item.id, changes);
    viewer.finishAnnotation();
  }

  watch(
    [annotations, selectedAnnotation, effectiveEdits, info, interactive],
    () => {
      if (!interactive.value) {
        finish(undefined, true);
      }
      scheduleDraw();
    },
    { deep: false },
  );
  onBeforeUnmount(() => {
    finish(undefined, true);
    surface.dispose();
  });

  return {
    root,
    canvas: surface.canvas,
    resizeHandle,
    selectedBounds: surface.selectedBounds,
    selectionStyle: surface.selectionStyle,
    handleStyle: surface.handleStyle,
    resizable: surface.resizable,
    interactive,
    start,
    move,
    finish,
    keydown,
  };
}
