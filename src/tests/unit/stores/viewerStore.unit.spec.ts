import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useViewerStore } from '@/stores/viewerStore';
import { useGlobalStore } from '@/stores/globalStore';
import { readyViewer } from '@tests/viewerStoreFixture';
import { annotation } from '@tests/canvasFixture';
import { imageDocument } from '@tests/fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('viewerStore', () => {
  it('awaits confirmation and prevents overlapping navigation requests', async () => {
    const viewer = useViewerStore();
    viewer.entries = [
      { id: 0, name: 'first.png' },
      { id: 1, name: 'second.png' },
    ];
    viewer.edits = { ...viewer.edits, brightness: 20 };

    const navigation = viewer.navigate(1);
    expect(viewer.leaveConfirmation).toBe(true);
    await viewer.navigate(1);
    expect(viewer.index).toBe(0);
    viewer.confirmLeave(false);
    await navigation;
    expect(viewer.index).toBe(0);
    expect(viewer.unsaved).toBe(true);

    const confirmation = viewer.canLeave();
    viewer.confirmLeave(true);
    expect(await confirmation).toBe(true);
    expect(viewer.leaveConfirmation).toBe(false);
    viewer.saving = true;
    expect(await viewer.canLeave()).toBe(false);
    viewer.saving = false;
    const pending = viewer.canLeave();
    viewer.$dispose();
    expect(await pending).toBe(false);
  });

  it('resets zoom after selecting a new image', async () => {
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:image', revokeObjectURL: vi.fn() });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => imageDocument() }),
    );
    const viewer = useViewerStore();
    viewer.zoom = 200;

    await viewer.selectFiles([new File(['image'], 'photo.png')]);
    await flushPromises();

    expect(viewer.zoom).toBe('fit');
    expect(viewer.currentName).toBe('photo.png');
    viewer.$dispose();
  });
  it.each(['close', 'edit', 'info'] as const)(
    'protects leaving the edit panel through %s and restores the original after discarding',
    async (action) => {
      const viewer = readyViewer();
      const global = useGlobalStore();
      global.panel = 'edit';
      viewer.edits.brightness = 20;
      const leave = () => (action === 'close' ? viewer.closePanel() : viewer.togglePanel(action));
      const cancelled = leave();
      expect(viewer.leaveConfirmation).toBe(true);
      expect(viewer.leaveContext).toBe('panel');
      expect(global.panel).toBe('edit');
      viewer.confirmLeave(false);
      await cancelled;
      expect(global.panel).toBe('edit');
      expect(viewer.edits.brightness).toBe(20);

      viewer.annotations = [annotation()];
      viewer.cropping = true;
      const confirmed = leave();
      viewer.confirmLeave(true);
      await confirmed;
      expect(global.panel).toBe(action === 'info' ? 'info' : null);
      expect(viewer.edits.brightness).toBe(0);
      expect(viewer.annotations).toEqual([]);
      expect(viewer.cropping).toBe(false);
      expect(viewer.unsaved).toBe(false);
      expect(viewer.displayedPreview).toBe(viewer.preview);
      viewer.$dispose();
    },
  );

  it('allows clean panel changes and blocks exit during saving without asking', async () => {
    const viewer = readyViewer();
    const global = useGlobalStore();
    await viewer.togglePanel('edit');
    await viewer.togglePanel('info');
    expect(global.panel).toBe('info');
    expect(await viewer.closePanel()).toBe('info');
    expect(viewer.leaveConfirmation).toBe(false);
    await viewer.togglePanel('edit');
    viewer.saving = true;
    await viewer.togglePanel('info');
    await viewer.closePanel();
    expect(global.panel).toBe('edit');
    expect(viewer.leaveConfirmation).toBe(false);
    viewer.saving = false;
    expect(await viewer.closePanel()).toBe('edit');
    expect(global.panel).toBeNull();
    viewer.preview = '';
    await viewer.togglePanel('info');
    expect(global.panel).toBeNull();
    viewer.$dispose();
  });
});
