import { platform } from '@/services/imageService';
import type { ExportFormat, ImageEdits, ImageEntry } from '@/types/types';
export { imageError, ImageClientError } from './imageErrors';

export function renderImage(entry: ImageEntry, edits: ImageEdits, signal?: AbortSignal) {
  return platform.renderImage(entry, edits, signal);
}

export function saveImage(
  entry: ImageEntry,
  edits: ImageEdits,
  format: ExportFormat,
  overlay?: Uint8Array,
) {
  return overlay
    ? platform.saveImage(entry, edits, format, overlay)
    : platform.saveImage(entry, edits, format);
}
