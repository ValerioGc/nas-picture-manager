import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useViewerShortcuts } from '@/composables/useViewerShortcuts';
import { useGlobalStore } from '@/stores/globalStore';
import { readyViewer } from '@tests/viewerStoreFixture';
import { annotation } from '@tests/canvasFixture';

function key(value: string, options: KeyboardEventInit = {}, element: EventTarget = document) {
  const event = new KeyboardEvent('keydown', {
    key: value,
    cancelable: true,
    bubbles: true,
    ...options,
  });
  element.dispatchEvent(event);
  return event;
}

afterEach(() => vi.restoreAllMocks());

describe('useViewerShortcuts', () => {
  it('keeps global shortcuts, ignores editable fields and protects unsaved work on unload', () => {
    const viewer = readyViewer();
    const open = vi.fn();
    const closePanel = vi.fn();
    const save = vi.spyOn(viewer, 'save').mockResolvedValue(undefined);
    const wrapper = mount({
      setup() {
        useViewerShortcuts({ closePanel, open });
        return () => null;
      },
    });
    expect(key('o', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledOnce();
    key('2', { metaKey: true });
    expect(viewer.zoom).toBe(200);
    expect(key('Escape', { altKey: true }).defaultPrevented).toBe(false);
    expect(closePanel).not.toHaveBeenCalled();
    expect(key('F11').defaultPrevented).toBe(false);

    const input = document.createElement('input');
    document.body.append(input);
    expect(key('o', { ctrlKey: true }, input).defaultPrevented).toBe(false);
    expect(open).toHaveBeenCalledOnce();
    expect(key('s', { ctrlKey: true }, input).defaultPrevented).toBe(true);
    expect(save).toHaveBeenCalledOnce();
    input.remove();

    const cleanUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanUnload);
    expect(cleanUnload.defaultPrevented).toBe(false);
    viewer.edits.brightness = 10;
    const dirtyUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyUnload);
    expect(dirtyUnload.defaultPrevented).toBe(true);
    wrapper.unmount();
    const unmountedUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unmountedUnload);
    expect(unmountedUnload.defaultPrevented).toBe(false);
    viewer.$dispose();
  });

  it('undoes, redoes and deletes annotations without intercepting editable fields or closed panels', () => {
    const viewer = readyViewer();
    useGlobalStore().panel = 'edit';
    viewer.setAnnotationTool('rectangle');
    viewer.beginAnnotation();
    const id = viewer.addAnnotation(annotation());
    viewer.finishAnnotation();
    const closePanel = vi.fn();
    const wrapper = mount({
      setup() {
        useViewerShortcuts({ closePanel, open: vi.fn() });
        return () => null;
      },
    });
    key('z', { ctrlKey: true });
    expect(viewer.annotations).toEqual([]);
    key('z', { metaKey: true, shiftKey: true });
    expect(viewer.annotations).toHaveLength(1);
    key('z', { ctrlKey: true });
    key('y', { ctrlKey: true });
    expect(viewer.annotations).toHaveLength(1);
    const input = document.createElement('textarea');
    document.body.append(input);
    expect(key('z', { ctrlKey: true }, input).defaultPrevented).toBe(false);
    expect(viewer.annotations).toHaveLength(1);
    input.remove();
    viewer.selectAnnotation(id);
    key('Delete');
    expect(viewer.annotations).toEqual([]);
    useGlobalStore().close_panel();
    key('z', { ctrlKey: true });
    expect(viewer.annotations).toEqual([]);
    key('Escape');
    expect(closePanel).toHaveBeenCalled();
    wrapper.unmount();
    viewer.$dispose();
  });
});
