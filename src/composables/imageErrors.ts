import type { ImageErrorCode } from '@/types/types';

const imageErrorCodes = new Set<ImageErrorCode>([
  'invalid_input',
  'file_too_large',
  'pixel_limit_exceeded',
  'dimension_limit_exceeded',
  'decode_memory_limit_exceeded',
  'too_many_files',
  'unsupported_format',
  'invalid_image',
  'unavailable',
  'busy',
  'invalid_edits',
  'save_failed',
]);

export class ImageClientError extends Error {
  constructor(readonly code: ImageErrorCode) {
    super(code);
    this.name = 'ImageClientError';
  }
}

export function imageError(value: unknown): ImageErrorCode {
  if (value instanceof ImageClientError) {
    return value.code;
  }

  const code = value instanceof Error ? value.message : value;
  return typeof code === 'string' && imageErrorCodes.has(code as ImageErrorCode)
    ? (code as ImageErrorCode)
    : 'unavailable';
}
