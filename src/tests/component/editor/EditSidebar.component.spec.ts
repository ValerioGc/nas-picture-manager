import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import EditSidebar from '@/components/editor/EditSidebar.vue';
import { useViewerStore } from '@/stores/viewerStore';
import { annotation } from '@tests/canvasFixture';
import { readyViewer } from '@tests/viewerStoreFixture';

describe('EditSidebar', () => {
  it('updates geometry and adjustments in the shared editor', async () => {
    const viewer = readyViewer();
    const wrapper = mount(EditSidebar);

    await wrapper.get('[data-testid="edit_rotate"]').trigger('click');
    await wrapper.get('[data-testid="rotate_right"]').trigger('click');
    expect(viewer.edits.rotation).toBe(1);

    await wrapper.get('[data-testid="edit_flip"]').trigger('click');
    await wrapper.get('[data-testid="flip_horizontal"]').trigger('click');
    expect(viewer.edits.flipHorizontal).toBe(true);

    expect(wrapper.find('[data-testid="edit_brightness"]').exists()).toBe(false);
    await wrapper.get('[data-testid="edit_modify"]').trigger('click');
    expect(wrapper.get('[data-testid="edit_modify"]').text()).toBe('Modifica');
    await wrapper.get('[data-testid="edit_brightness"]').setValue('20');
    expect(viewer.edits.brightness).toBe(20);
    await wrapper.get('[data-testid="edit_contrast"]').setValue('10');
    await wrapper.get('[data-testid="edit_sharpness"]').setValue('30');
    await wrapper.get('[data-testid="edit_annotations"]').trigger('click');
    expect(wrapper.find('[data-testid="edit_brightness"]').exists()).toBe(false);
    expect(viewer.edits).toMatchObject({ brightness: 20, contrast: 10, sharpness: 30 });
    await wrapper.get('[data-testid="edit_modify"]').trigger('click');
    expect(wrapper.find('[data-testid="annotation_tool_select"]').exists()).toBe(false);
    expect(viewer.annotationTool).toBeNull();
    expect(wrapper.get('[data-testid="edit_brightness"]').element).toHaveProperty('value', '20');
    wrapper.unmount();
    viewer.$dispose();
  });

  it('validates the crop and disables saving while processing', async () => {
    const viewer = readyViewer();
    viewer.startCrop();
    viewer.crop = { x: 639, y: 0, width: 2, height: 1 };
    const wrapper = mount(EditSidebar);

    expect(wrapper.get('[data-testid="crop_apply"]').attributes('disabled')).toBeDefined();
    await wrapper.get('[data-testid="crop_ratio"]').setValue('4:3');
    expect(viewer.cropRatio).toBe('4:3');
    viewer.processing = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="edit_save"]').attributes('disabled')).toBeDefined();
    await wrapper.get('[data-testid="crop_cancel"]').trigger('click');
    expect(viewer.cropping).toBe(false);
    wrapper.unmount();
    viewer.$dispose();
  });

  it('shows export format and starts a save', async () => {
    const viewer = readyViewer();
    const save = vi.spyOn(viewer, 'save').mockResolvedValue();
    const wrapper = mount(EditSidebar);

    await wrapper.get('[data-testid="export_format"]').setValue('jpeg');
    expect(viewer.format).toBe('jpeg');
    expect(wrapper.text()).toContain('sfondo bianco');
    await wrapper.get('[data-testid="edit_save"]').trigger('click');
    expect(save).toHaveBeenCalledOnce();
    wrapper.unmount();
    viewer.$dispose();
  });

  it('shows disabled and error states without an image', async () => {
    const viewer = useViewerStore();
    const wrapper = mount(EditSidebar);
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('Nessuna immagine aperta');
    viewer.editError = 'save_failed';
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="edit_error"]').text()).toContain('Impossibile salvare');
    wrapper.unmount();
    viewer.$dispose();
  });

  it('opens annotation controls on demand and stops drawing when switching tools', async () => {
    const viewer = readyViewer();
    const wrapper = mount(EditSidebar);
    expect(wrapper.find('[data-testid="annotation_tool_rectangle"]').exists()).toBe(false);
    expect(viewer.annotationTool).toBeNull();
    expect(wrapper.get('[data-testid="edit_annotations"]').text()).toBe('Disegna');
    await wrapper.get('[data-testid="edit_annotations"]').trigger('click');
    expect(viewer.annotationTool).toBe('select');
    await wrapper.get('[data-testid="annotation_tool_rectangle"]').trigger('click');
    viewer.beginAnnotation();
    viewer.addAnnotation(annotation());
    viewer.finishAnnotation();
    await wrapper.get('[data-testid="edit_rotate"]').trigger('click');
    expect(wrapper.find('[data-testid="annotation_tool_rectangle"]').exists()).toBe(false);
    expect(viewer.annotationTool).toBeNull();
    expect(viewer.annotations).toHaveLength(1);
    await wrapper.get('[data-testid="edit_annotations"]').trigger('click');
    expect(viewer.annotationTool).toBe('select');
    expect(viewer.annotations).toHaveLength(1);
    viewer.saving = true;
    wrapper.unmount();
    expect(viewer.annotationTool).toBeNull();
    expect(viewer.annotations).toHaveLength(1);
    viewer.$dispose();
  });

  it('cancels an unfinished annotation when the panel closes', async () => {
    const viewer = readyViewer();
    const wrapper = mount(EditSidebar);
    await wrapper.get('[data-testid="edit_annotations"]').trigger('click');
    viewer.beginAnnotation();
    viewer.addAnnotation(annotation());
    wrapper.unmount();
    expect(viewer.annotationTool).toBeNull();
    expect(viewer.annotating).toBe(false);
    expect(viewer.annotations).toEqual([]);
    viewer.$dispose();
  });

  it('offers Original last and uses it for source formats outside the explicit choices', async () => {
    const viewer = readyViewer();
    viewer.info = { ...viewer.info!, format: 'JPG' };
    const wrapper = mount(EditSidebar);
    const options = wrapper.get('[data-testid="export_format"]').findAll('option');
    expect(options.map((option) => option.attributes('value'))).toEqual([
      'png',
      'jpeg',
      'webp',
      'original',
    ]);
    expect(options.at(-1)?.text()).toBe('Originale');
    await wrapper.get('[data-testid="export_format"]').setValue('original');
    expect(viewer.exportFormat).toBe('jpeg');
    expect(wrapper.text()).toContain('sfondo bianco');
    viewer.info = { ...viewer.info!, format: 'GIF' };
    await wrapper.vm.$nextTick();
    await wrapper.get('[data-testid="export_format"]').setValue('original');
    expect(viewer.format).toBe('original');
    expect(viewer.exportFormat).toBe('gif');
    expect(wrapper.get('[data-testid="export_format"]').element).toHaveProperty(
      'value',
      'original',
    );
    await wrapper.get('[data-testid="export_format"]').setValue('webp');
    wrapper.unmount();
    viewer.$dispose();
  });
});
