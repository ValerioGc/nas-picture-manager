import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnnotationSurface from '@/components/editor/AnnotationSurface.vue';
import { useGlobalStore } from '@/stores/globalStore';
import { readyViewer } from '@tests/viewerStoreFixture';
import { annotation, canvasContext } from '@tests/canvasFixture';
import { imageDocument } from '@tests/fixtures';

vi.mock('@/composables/imageClient', () => ({
  renderImage: vi.fn(async () => imageDocument()),
  saveImage: vi.fn(),
  imageError: () => 'unavailable',
}));

let viewer: ReturnType<typeof readyViewer>;
let wrapper: ReturnType<typeof mount<typeof AnnotationSurface>>;
let resize: () => void;

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    return canvasContext(this);
  });
  viewer = readyViewer();
  useGlobalStore().panel = 'edit';
  viewer.setAnnotationTool('rectangle');
  wrapper = mount(AnnotationSurface, { attachTo: document.body });
  const root = wrapper.element as HTMLElement;
  root.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 640,
    height: 480,
    right: 640,
    bottom: 480,
    toJSON: () => ({}),
  });
  root.setPointerCapture = vi.fn();
  root.releasePointerCapture = vi.fn();
  root.hasPointerCapture = vi.fn(() => true);
  resize();
});

afterEach(() => {
  wrapper.unmount();
  viewer.$dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function pointer(type: string, x: number, y: number, extra: Record<string, unknown> = {}) {
  const event = new MouseEvent(type, {
    button: 0,
    clientX: x,
    clientY: y,
    bubbles: true,
    ...extra,
  });
  Object.defineProperty(event, 'pointerId', { value: extra.pointerId ?? 1 });
  wrapper.element.dispatchEvent(event);
  await nextTick();
}

async function resizeHandle(x: number, y: number) {
  const event = new MouseEvent('pointerdown', { button: 0, clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  wrapper.get('[data-testid="annotation_resize"]').element.dispatchEvent(event);
  await nextTick();
}

async function draw(x = 10, y = 20, endX = 50, endY = 80) {
  await pointer('pointerdown', x, y);
  await pointer('pointermove', endX, endY);
  await pointer('pointerup', endX, endY);
}

describe('AnnotationSurface', () => {
  it('moves only the topmost annotation when shapes overlap', async () => {
    viewer.annotations = [
      annotation({ id: 1, x: 10, y: 10, width: 80, height: 80 }),
      annotation({ id: 2, x: 20, y: 20, width: 60, height: 60 }),
    ];
    viewer.setAnnotationTool('select');
    await nextTick();
    await draw(30, 30, 40, 50);
    expect(viewer.annotationSelection).toBe(2);
    expect(viewer.annotations[0]).toMatchObject({ id: 1, x: 10, y: 10 });
    expect(viewer.annotations[1]).toMatchObject({ id: 2, x: 30, y: 40 });
    viewer.undoAnnotation();
    expect(viewer.annotations[1]).toMatchObject({ id: 2, x: 20, y: 20 });
  });

  it('draws, moves and resizes a rectangle and groups each gesture for undo', async () => {
    await draw();
    expect(viewer.annotations[0]).toMatchObject({ x: 10, y: 20, width: 40, height: 60 });
    expect(viewer.annotating).toBe(false);
    await draw(30, 40, 50, 60);
    expect(viewer.annotationTool).toBe('select');
    expect(viewer.annotations).toHaveLength(1);
    expect(viewer.annotations[0]).toMatchObject({ x: 30, y: 40 });
    expect(wrapper.find('[data-testid="annotation_resize"]').exists()).toBe(true);
    await resizeHandle(70, 100);
    await pointer('pointerup', 100, 140);
    expect(viewer.annotations[0]).toMatchObject({ width: 70, height: 100 });
    viewer.undoAnnotation();
    expect(viewer.annotations[0]).toMatchObject({ width: 40, height: 60 });
    viewer.undoAnnotation();
    expect(viewer.annotations[0]).toMatchObject({ x: 10, y: 20 });
  });

  it('moves and resizes selections with arrow keys without triggering image navigation', async () => {
    await draw();
    await wrapper.trigger('keydown', { key: 'ArrowRight', shiftKey: true });
    expect(viewer.annotations[0]?.x).toBe(20);
    await wrapper.get('[data-testid="annotation_resize"]').trigger('keydown', { key: 'ArrowDown' });
    expect(viewer.annotations[0]?.height).toBe(61);
    viewer.setAnnotationTool('circle');
    await draw(10, 10, 30, 30);
    await wrapper
      .get('[data-testid="annotation_resize"]')
      .trigger('keydown', { key: 'ArrowRight' });
    expect(viewer.annotations[1]).toMatchObject({ width: 21, height: 21 });
    viewer.setAnnotationTool('text');
    await draw(100, 10, 100, 10);
    await wrapper.get('[data-testid="annotation_resize"]').trigger('keydown', { key: 'ArrowDown' });
    expect(viewer.annotations[2]?.style.fontSize).toBe(25);
  });

  it('constrains circles and Shift rectangles and draws lines in either direction', async () => {
    await pointer('pointerdown', 100, 100);
    await pointer('pointerup', 40, 70, { shiftKey: true });
    expect(viewer.annotations[0]).toMatchObject({ x: 70, y: 70, width: 30, height: 30 });
    viewer.setAnnotationTool('circle');
    await draw(30, 30, 70, 90);
    expect(viewer.annotations[1]).toMatchObject({ kind: 'circle', width: 40, height: 40 });
    viewer.setAnnotationTool('line');
    await draw(170, 190, 120, 140);
    expect(viewer.annotations[2]).toMatchObject({ kind: 'line', width: -50, height: -50 });
    viewer.setAnnotationTool('select');
    await draw(500, 400, 550, 440);
    expect(viewer.annotationSelection).toBeNull();
    expect(viewer.annotations).toHaveLength(3);
  });

  it('draws brush strokes, moves them and ignores nearly identical samples', async () => {
    viewer.setAnnotationTool('highlight');
    await pointer('pointerdown', 50, 50);
    await pointer('pointermove', 50.1, 50.1);
    await pointer('pointermove', 60, 70);
    await pointer('pointerup', 80, 90);
    expect(viewer.annotations[0]).toMatchObject({
      kind: 'highlight',
      style: { opacity: 0.35 },
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ],
    });
    viewer.setAnnotationTool('select');
    await draw(60, 70, 0, 0);
    expect(viewer.annotations[0]).toMatchObject({ x: 0, y: 0 });
    expect(wrapper.find('[data-testid="annotation_resize"]').exists()).toBe(false);
    viewer.setAnnotationTool('pen');
    await pointer('pointerdown', 110, 110);
    await pointer('pointerup', 110, 110);
    expect(viewer.annotations[1]?.points).toHaveLength(1);
  });

  it('places multiline text and changes its size using the selection handle', async () => {
    viewer.setAnnotationTool('text');
    viewer.setAnnotationText('Hello\nWorld');
    await draw();
    expect(viewer.annotations[0]).toMatchObject({
      kind: 'text',
      text: 'Hello\nWorld',
      x: 10,
      y: 20,
    });
    await resizeHandle(70, 78);
    await pointer('pointerup', 100, 100);
    expect(viewer.annotations[0]?.style.fontSize).toBe(33);
  });

  it('cancels interrupted gestures, ignores other pointers, and rejects empty shapes', async () => {
    await pointer('pointermove', 50, 60);
    await pointer('pointerdown', 20, 20, { button: 1 });
    expect(viewer.annotations).toEqual([]);
    await pointer('pointerdown', 20, 20);
    await pointer('pointerdown', 30, 30);
    await pointer('pointermove', 50, 60, { pointerId: 2 });
    await pointer('pointerup', 50, 60, { pointerId: 2 });
    expect(viewer.annotating).toBe(true);
    await pointer('pointercancel', 50, 60);
    expect(viewer.annotations).toEqual([]);
    await pointer('pointerdown', 20, 20);
    await pointer('pointerup', 20, 20);
    expect(viewer.annotations).toEqual([]);
    await pointer('pointerdown', 20, 20);
    await pointer('lostpointercapture', 20, 20);
    expect(viewer.annotations).toEqual([]);
    await pointer('pointerdown', 20, 20);
    useGlobalStore().close_panel();
    await nextTick();
    expect(viewer.annotations).toEqual([]);
    await pointer('pointerdown', 20, 20);
    expect(viewer.annotations).toEqual([]);
  });

  it('uses original image coordinates after rotation, flips and cropping, and respects limits', async () => {
    viewer.edits = {
      ...viewer.edits,
      rotation: 1,
      flipHorizontal: true,
      crop: { x: 20, y: 30, width: 200, height: 100 },
    };
    viewer.processing = false;
    await nextTick();
    await draw(64, 48, 128, 96);
    expect(viewer.annotations[0]).toMatchObject({ x: 40, y: 40, width: 10, height: 20 });
    viewer.setAnnotationTool('pen');
    viewer.annotations = [
      annotation({ points: Array.from({ length: 20000 }, () => ({ x: 0, y: 0 })) }),
    ];
    await pointer('pointerdown', 30, 30);
    expect(viewer.annotations).toHaveLength(1);
  });
});
