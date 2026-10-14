import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AnnotationControls from '@/components/editor/AnnotationControls.vue';
import { readyViewer } from '@tests/viewerStoreFixture';
import { annotation } from '@tests/canvasFixture';

describe('AnnotationControls', () => {
  it('shows the appropriate fields for each tool and disables controls during drawing', async () => {
    const viewer = readyViewer();
    const wrapper = mount(AnnotationControls);
    for (const kind of ['rectangle', 'circle', 'line', 'text', 'pen', 'highlight']) {
      await wrapper.get(`[data-testid="annotation_tool_${kind}"]`).trigger('click');
      expect(wrapper.find('[data-testid="annotation_size"]').exists()).toBe(kind !== 'text');
      expect(wrapper.find('[data-testid="annotation_fill"]').exists()).toBe(
        kind === 'rectangle' || kind === 'circle',
      );
      expect(wrapper.find('[data-testid="annotation_text"]').exists()).toBe(kind === 'text');
      expect(wrapper.find('[data-testid="annotation_font_size"]').exists()).toBe(kind === 'text');
    }
    viewer.beginAnnotation();
    await wrapper.vm.$nextTick();
    expect(
      wrapper.findAll('button').every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true);
    expect(wrapper.get('input[type="color"]').element.matches(':disabled')).toBe(true);
    viewer.finishAnnotation(true);
    wrapper.unmount();
    viewer.$dispose();
  });

  it('changes tools and styles and edits selected multiline text', async () => {
    const viewer = readyViewer();
    const wrapper = mount(AnnotationControls);
    expect(viewer.annotationTool).toBe('select');
    expect(
      wrapper
        .findAll('button')
        .slice(0, 3)
        .map((button) => button.attributes('data-testid')),
    ).toEqual(['annotation_undo', 'annotation_redo', 'annotation_tool_select']);
    expect(wrapper.findAll('[data-testid="annotation_tool_select"]')).toHaveLength(1);
    for (const button of wrapper.findAll('button')) {
      expect(button.attributes('title')).toBe(button.attributes('aria-label'));
      expect(button.find('[aria-hidden="true"]').exists()).toBe(true);
    }
    await wrapper.get('[data-testid="annotation_tool_rectangle"]').trigger('click');
    expect(
      wrapper.get('[data-testid="annotation_tool_rectangle"]').attributes('aria-pressed'),
    ).toBe('true');
    await wrapper.get('[data-testid="annotation_color"]').setValue('#00ff00');
    await wrapper.get('[data-testid="annotation_size"]').setValue('12');
    await wrapper.get('[data-testid="annotation_opacity"]').setValue('0.5');
    await wrapper.get('[data-testid="annotation_fill"]').setValue(true);
    expect(viewer.annotationStyle).toMatchObject({
      color: '#00ff00',
      size: 12,
      opacity: 0.5,
      filled: true,
    });
    viewer.beginAnnotation();
    viewer.addAnnotation(annotation({ kind: 'text' }));
    viewer.finishAnnotation();
    await wrapper.get('[data-testid="annotation_tool_select"]').trigger('click');
    viewer.selectAnnotation(1);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('select').exists()).toBe(false);
    await wrapper.get('[data-testid="annotation_text"]').setValue('New\nNote');
    await wrapper.get('[data-testid="annotation_font_size"]').setValue('32');
    expect(wrapper.find('[data-testid="annotation_size"]').exists()).toBe(false);
    expect(viewer.annotations[0]).toMatchObject({ text: 'New\nNote', style: { fontSize: 32 } });
    await wrapper.get('[data-testid="annotation_delete"]').trigger('click');
    expect(viewer.annotations).toEqual([]);
    await wrapper.get('[data-testid="annotation_undo"]').trigger('click');
    expect(viewer.annotations).toHaveLength(1);
    await wrapper.get('[data-testid="annotation_redo"]').trigger('click');
    expect(viewer.annotations).toEqual([]);
    expect(wrapper.find('[data-testid="annotation_selection"]').exists()).toBe(false);
    expect(viewer.annotationSelection).toBeNull();
    wrapper.unmount();
    expect(viewer.annotationTool).toBeNull();
    viewer.$dispose();
  });

  it('disables conflicting tools during a crop and reports limits', async () => {
    const viewer = readyViewer();
    viewer.setAnnotationTool('circle');
    viewer.annotations = Array.from({ length: 200 }, (_, id) => annotation({ id }));
    const wrapper = mount(AnnotationControls);
    expect(wrapper.get('output').text()).toContain('Limite di annotazioni');
    viewer.startCrop();
    await wrapper.vm.$nextTick();
    expect(
      wrapper.get('[data-testid="annotation_tool_circle"]').attributes('disabled'),
    ).toBeDefined();
    expect(viewer.annotationTool).toBeNull();
    wrapper.unmount();
    viewer.$dispose();
  });
});
