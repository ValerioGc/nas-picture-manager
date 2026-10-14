import { describe, expect, it } from 'vitest';
import {
  copyAnnotations,
  MAX_ANNOTATIONS,
  MAX_ANNOTATION_POINTS,
  useImageAnnotations,
} from '@/composables/useImageAnnotations';
import { annotation } from '@tests/canvasFixture';

function add(editor: ReturnType<typeof useImageAnnotations>) {
  editor.beginAnnotation();
  const id = editor.addAnnotation(annotation())!;
  editor.finishAnnotation();
  return id;
}

describe('useImageAnnotations', () => {
  it('groups a gesture into one undo and redo operation, preserving independent snapshots', () => {
    const editor = useImageAnnotations();
    const id = add(editor);
    editor.beginAnnotation();
    editor.beginAnnotation();
    editor.updateAnnotation(id, { x: 30 });
    editor.updateAnnotation(id, { x: 40 });
    editor.finishAnnotation();
    editor.undoAnnotation();
    expect(editor.annotations.value[0]?.x).toBe(10);
    editor.redoAnnotation();
    expect(editor.annotations.value[0]?.x).toBe(40);
    editor.undoAnnotation();
    editor.undoAnnotation();
    expect(editor.annotations.value).toEqual([]);
    editor.redoAnnotation();
    editor.setAnnotationStyle({ size: 8 });
    expect(editor.canRedoAnnotation.value).toBe(true);
    editor.selectAnnotation(id);
    editor.setAnnotationStyle({ color: '#00ff00' });
    expect(editor.canRedoAnnotation.value).toBe(false);
    editor.undoAnnotation();
    expect(editor.annotations.value[0]?.style.color).toBe('#ff0000');
  });

  it('cancels incomplete gestures and switches tools without creating a history entry', () => {
    const editor = useImageAnnotations();
    editor.beginAnnotation();
    editor.addAnnotation(annotation());
    editor.setAnnotationTool('highlight');
    expect(editor.annotations.value).toEqual([]);
    expect(editor.annotationSelection.value).toBeNull();
    expect(editor.annotationStyle.value).toMatchObject({ size: 20, opacity: 0.35 });
    editor.setAnnotationTool('pen');
    expect(editor.annotationStyle.value).toMatchObject({ size: 4, opacity: 1 });
    editor.setAnnotationTool(null);
    editor.undoAnnotation();
    editor.redoAnnotation();
    expect(editor.canUndoAnnotation.value).toBe(false);
  });

  it('edits selected styles and text, clamps input, and deletes only the selected annotation', () => {
    const editor = useImageAnnotations();
    const id = add(editor);
    editor.setAnnotationText('new');
    expect(editor.selectedAnnotation.value?.text).toBe('Note');
    editor.updateAnnotation(id, { kind: 'text' });
    editor.setAnnotationText('A'.repeat(2100));
    expect(editor.selectedAnnotation.value?.text).toHaveLength(2000);
    editor.setAnnotationStyle({ fontSize: 300, size: -1, opacity: 2, color: 'invalid' });
    expect(editor.selectedAnnotation.value?.style).toEqual({
      fontSize: 200,
      size: 1,
      opacity: 1,
      color: '#ff0000',
      filled: false,
    });
    editor.setAnnotationStyle({ fontSize: NaN, size: Infinity, opacity: NaN });
    expect(editor.selectedAnnotation.value?.style).toMatchObject({
      fontSize: 24,
      size: 4,
      opacity: 1,
    });
    add(editor);
    editor.selectAnnotation(id);
    editor.removeAnnotation();
    expect(editor.annotations.value).toHaveLength(1);
    editor.removeAnnotation();
    editor.undoAnnotation();
    expect(editor.annotations.value).toHaveLength(2);
    editor.resetAnnotations();
    expect(editor.annotations.value).toEqual([]);
    expect(editor.canUndoAnnotation.value).toBe(false);
    expect(editor.canRedoAnnotation.value).toBe(false);
  });

  it('caps objects, points and history without reusing identifiers', () => {
    const editor = useImageAnnotations();
    for (let count = 0; count < MAX_ANNOTATIONS; count++) {
      add(editor);
    }
    expect(editor.annotationLimit.value).toBe(true);
    expect(editor.addAnnotation(annotation())).toBeNull();
    for (let count = 0; count < 55; count++) {
      editor.undoAnnotation();
    }
    expect(editor.annotations.value).toHaveLength(MAX_ANNOTATIONS - 50);
    editor.resetAnnotations();
    add(editor);
    const id = editor.selectedAnnotation.value!.id;
    expect(id).toBeGreaterThan(MAX_ANNOTATIONS);
    editor.updateAnnotation(id, {
      points: Array.from({ length: MAX_ANNOTATION_POINTS }, () => ({ x: 1, y: 1 })),
    });
    expect(editor.annotationLimit.value).toBe(true);
    const copy = copyAnnotations(editor.annotations.value);
    copy[0]!.points[0]!.x = 10;
    expect(editor.annotations.value[0]?.points[0]?.x).toBe(1);
  });
});
