import { platform } from '@/services/imageService';
import type { ExportFormat, ImageEdits, ImageEntry } from '@/types/types';
export { imageError, ImageClientError } from './imageErrors';

/**
 * Renders an image with the specified edits.
 * @param entry - The image entry to be rendered.
 * @param edits - The edits to be applied to the image.
 * @param signal - An optional AbortSignal to cancel the rendering.
 * @returns A promise that resolves with the rendered image.
 */
export function renderImage(entry: ImageEntry, edits: ImageEdits, signal?: AbortSignal) {
  return platform.renderImage(entry, edits, signal);
}

/**
 * Saves an edited image in the specified format.
 * @param entry - The image entry to be saved.
 * @param edits - The edits to be applied to the image.
 * @param format - The format in which to save the edited image.
 * @returns A promise that resolves when the image has been successfully saved.
 */
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
