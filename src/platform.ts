import type { ExportFormat, ImageDocument, ImageEdits, ImageEntry } from '@/types/types';

/**
 * Shared capabilities
 */
export interface ImagePlatform {
  inspectImage(entry: ImageEntry, signal?: AbortSignal): Promise<ImageDocument>;
  renderImage(entry: ImageEntry, edits: ImageEdits, signal?: AbortSignal): Promise<ImageDocument>;
  saveImage(
    entry: ImageEntry,
    edits: ImageEdits,
    format: ExportFormat,
    overlay?: Uint8Array,
  ): Promise<string | null>;
}
