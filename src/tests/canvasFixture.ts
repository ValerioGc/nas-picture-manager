import { vi } from 'vitest';
import type { ImageAnnotation } from '@/types/types';

export function canvasContext(canvas = document.createElement('canvas')) {
  return {
    canvas,
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    transform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 12 })),
  } as unknown as CanvasRenderingContext2D;
}

export function annotation(changes: Partial<ImageAnnotation> = {}): ImageAnnotation {
  return {
    id: 1,
    kind: 'rectangle',
    x: 10,
    y: 20,
    width: 30,
    height: 40,
    text: 'Note',
    points: [],
    style: { color: '#ff0000', size: 4, opacity: 1, filled: false, fontSize: 24 },
    ...changes,
  };
}
