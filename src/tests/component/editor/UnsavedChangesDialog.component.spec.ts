import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import UnsavedChangesDialog from '@/components/editor/UnsavedChangesDialog.vue';
import { readyViewer } from '@tests/viewerStoreFixture';

async function openDialog() {
  const viewer = readyViewer();
  viewer.edits.brightness = 20;
  const confirmation = viewer.canLeave();
  const wrapper = mount(UnsavedChangesDialog, { attachTo: document.body });
  return { viewer, confirmation, wrapper };
}

describe('UnsavedChangesDialog', () => {
  it('opens a labelled modal with cancellation focused and confirms discarding edits', async () => {
    const { viewer, confirmation, wrapper } = await openDialog();
    expect(wrapper.attributes()).toHaveProperty('open');
    expect(wrapper.get('#unsaved_title').text()).toBe('Modifiche non salvate');
    expect(document.activeElement).toBe(wrapper.get('[data-testid="unsaved_cancel"]').element);
    await wrapper.get('[data-testid="unsaved_discard"]').trigger('click');
    expect(await confirmation).toBe(true);
    wrapper.unmount();
    viewer.$dispose();
  });

  it('keeps edits when cancelled with Escape or closed', async () => {
    const { viewer, confirmation, wrapper } = await openDialog();
    await wrapper.trigger('cancel');
    expect(await confirmation).toBe(false);
    expect(viewer.unsaved).toBe(true);
    const second = viewer.canLeave();
    await wrapper.trigger('close');
    expect(await second).toBe(false);
    wrapper.unmount();
    viewer.$dispose();
  });

  it('cancels a pending operation if the modal unmounts', async () => {
    const { viewer, confirmation, wrapper } = await openDialog();
    wrapper.unmount();
    expect(await confirmation).toBe(false);
    viewer.$dispose();
  });
  it('distinguishes continuing editing from discarding and restores the original', async () => {
    const viewer = readyViewer();
    viewer.edits.brightness = 20;
    const confirmation = viewer.canLeave('panel');
    const wrapper = mount(UnsavedChangesDialog);
    expect(wrapper.get('#unsaved_message').text()).toContain('torna all’originale');
    expect(wrapper.get('[data-testid="unsaved_discard"]').text()).toBe('Annulla modifiche');
    expect(wrapper.get('[data-testid="unsaved_cancel"]').text()).toBe('Continua modifica');
    await wrapper.get('[data-testid="unsaved_discard"]').trigger('click');
    expect(await confirmation).toBe(true);
    expect(viewer.edits.brightness).toBe(0);
    expect(viewer.unsaved).toBe(false);
    wrapper.unmount();
    viewer.$dispose();
  });
});
