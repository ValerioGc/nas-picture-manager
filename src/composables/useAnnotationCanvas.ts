import { computed, onMounted, ref } from 'vue';
import type { Ref } from 'vue';
import { storeToRefs } from 'pinia';
import type { useViewerStore } from '@/stores/viewerStore';
import {
  annotationBounds,
  annotationDimensions,
  annotationPoint,
  drawAnnotations,
  hitAnnotation,
} from '@/services/annotations';
import type { ImageAnnotation, ImageEdits, ImagePoint } from '@/types/types';

export function useAnnotationCanvas(
  viewer: ReturnType<typeof useViewerStore>,
  effectiveEdits: Readonly<Ref<ImageEdits>>,
  beforeDraw: () => void,
) {
  const { annotations, selectedAnnotation, info } = storeToRefs(viewer);
  const canvas = ref<HTMLCanvasElement | null>(null);
  const root = ref<HTMLDivElement | null>(null);
  const resizeHandle = ref<HTMLButtonElement | null>(null);
  const selectedBounds = ref<ReturnType<typeof annotationBounds> | null>(null);

  let observer: ResizeObserver | undefined;
  let frame: number | undefined;

  function scheduleDraw() {
    frame ??= requestAnimationFrame(() => {
      frame = undefined;
      beforeDraw();
      draw();
    });
  }

  const selectionStyle = computed(() => {
    if (!selectedBounds.value || !info.value) {
      return {};
    }

    const bounds = selectedBounds.value;
    const start = annotationPoint({ x: bounds.x, y: bounds.y }, info.value, effectiveEdits.value);
    const end = annotationPoint(
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      info.value,
      effectiveEdits.value,
    );

    const dimensions = annotationDimensions(info.value, effectiveEdits.value);
    return {
      left: `${(Math.min(start.x, end.x) / dimensions.width) * 100}%`,
      top: `${(Math.min(start.y, end.y) / dimensions.height) * 100}%`,
      width: `${(Math.abs(end.x - start.x) / dimensions.width) * 100}%`,
      height: `${(Math.abs(end.y - start.y) / dimensions.height) * 100}%`,
    };
  });

  const handleStyle = computed(() => {
    if (!selectedBounds.value || !info.value) {
      return {};
    }

    const bounds = selectedBounds.value;
    const item = selectedAnnotation.value;
    const endpoint =
      item?.kind === 'line'
        ? { x: item.x + item.width, y: item.y + item.height }
        : { x: bounds.x + bounds.width, y: bounds.y + bounds.height };
    const point = annotationPoint(endpoint, info.value, effectiveEdits.value);
    const dimensions = annotationDimensions(info.value, effectiveEdits.value);

    return {
      left: `${(point.x / dimensions.width) * 100}%`,
      top: `${(point.y / dimensions.height) * 100}%`,
    };
  });

  const resizable = computed(
    () => selectedAnnotation.value && !['pen', 'highlight'].includes(selectedAnnotation.value.kind),
  );

  function draw() {
    const context = canvas.value?.getContext('2d');
    if (!context || !info.value || !root.value) {
      return;
    }

    const bounds = root.value.getBoundingClientRect();
    const dimensions = annotationDimensions(info.value, effectiveEdits.value);
    const scale = Math.min(1, 2048 / Math.max(dimensions.width, dimensions.height));
    const width = Math.max(
      1,
      Math.round(Math.min(dimensions.width * scale, bounds.width * window.devicePixelRatio)),
    );

    const height = Math.max(
      1,
      Math.round(Math.min(dimensions.height * scale, bounds.height * window.devicePixelRatio)),
    );

    if (context.canvas.width !== width) {
      context.canvas.width = width;
    }

    if (context.canvas.height !== height) {
      context.canvas.height = height;
    }

    drawAnnotations(context, annotations.value, info.value, effectiveEdits.value);
    selectedBounds.value = selectedAnnotation.value
      ? annotationBounds(selectedAnnotation.value, context)
      : null;
  }

  function point(event: PointerEvent): ImagePoint {
    const bounds = root.value!.getBoundingClientRect();
    const dimensions = annotationDimensions(info.value!, effectiveEdits.value);
    const position = annotationPoint(
      {
        x:
          Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * dimensions.width,
        y:
          Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) *
          dimensions.height,
      },
      info.value!,
      effectiveEdits.value,
      true,
    );

    return {
      x: Math.max(0, Math.min(info.value!.width, position.x)),
      y: Math.max(0, Math.min(info.value!.height, position.y)),
    };
  }

  function boundsFor(item: ImageAnnotation) {
    const context = canvas.value?.getContext('2d');
    return context ? annotationBounds(item, context) : null;
  }

  function hitAt(origin: ImagePoint) {
    const context = canvas.value?.getContext('2d');
    if (!context || !info.value || !root.value) {
      return undefined;
    }
    const tolerance =
      (6 * annotationDimensions(info.value, effectiveEdits.value).width) /
      root.value.getBoundingClientRect().width;
    // Search topmost first without copying the entire annotation list.
    for (let index = annotations.value.length - 1; index >= 0; index -= 1) {
      const candidate = annotations.value[index]!;
      if (hitAnnotation(candidate, origin, context, tolerance)) {
        return candidate;
      }
    }
    return undefined;
  }

  onMounted(() => {
    observer = new ResizeObserver(scheduleDraw);
    if (root.value) {
      observer.observe(root.value);
    }
    draw();
  });

  function dispose() {
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
      frame = undefined;
    }
    observer?.disconnect();
  }

  return {
    canvas,
    root,
    resizeHandle,
    selectedBounds,
    selectionStyle,
    handleStyle,
    resizable,
    draw,
    point,
    boundsFor,
    hitAt,
    scheduleDraw,
    dispose,
  };
}
