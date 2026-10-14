import { ImageClientError } from '@/composables/imageErrors';
import type { ImageDocument, ImageInfo } from '@/types/types';

export const IMAGE_DOCUMENT_TYPE = 'application/vnd.picture-manager.image';

export function readImageDocument(buffer: ArrayBuffer): ImageDocument {
  if (buffer.byteLength < 4 || buffer.byteLength > 64 * 1024 * 1024 + 8196) {
    throw new ImageClientError('invalid_image');
  }

  const length = new DataView(buffer).getUint32(0, true);
  if (!length || length > 8192 || length + 4 >= buffer.byteLength) {
    throw new ImageClientError('invalid_image');
  }

  let info: unknown;
  try {
    info = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(buffer, 4, length)),
    );
  } catch {
    throw new ImageClientError('invalid_image');
  }

  if (
    !info ||
    typeof info !== 'object' ||
    !('width' in info) ||
    !('height' in info) ||
    !Number.isInteger(info.width) ||
    !Number.isInteger(info.height) ||
    typeof info.width !== 'number' ||
    typeof info.height !== 'number' ||
    info.width < 1 ||
    info.height < 1 ||
    info.width > 16384 ||
    info.height > 16384 ||
    info.width * info.height > 100_000_000 ||
    !('name' in info) ||
    typeof info.name !== 'string' ||
    !('format' in info) ||
    typeof info.format !== 'string' ||
    !('hasAlpha' in info) ||
    typeof info.hasAlpha !== 'boolean' ||
    !('size' in info) ||
    typeof info.size !== 'number' ||
    !Number.isSafeInteger(info.size) ||
    info.size < 0 ||
    info.size > 30 * 1024 * 1024 ||
    !('folder' in info) ||
    (info.folder !== null && typeof info.folder !== 'string') ||
    !('created' in info) ||
    !validTimestamp(info.created) ||
    !('modified' in info) ||
    !validTimestamp(info.modified)
  ) {
    throw new ImageClientError('invalid_image');
  }

  return { info: info as ImageInfo, preview: new Uint8Array(buffer, 4 + length) };
}

function validTimestamp(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
}

export function previewBlob(document: ImageDocument): Blob {
  const bytes =
    document.preview instanceof Uint8Array ? document.preview : new Uint8Array(document.preview);
  return new Blob([bytes], { type: 'image/png' });
}
