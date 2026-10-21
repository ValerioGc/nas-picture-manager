import { ImageClientError, imageError } from '@/composables/imageErrors';
import type { ExportFormat, ImageDocument, ImageEdits, ImageEntry } from '@/types/types';
import type { ImagePlatform } from '@/platform';
import { t } from '@/i18n';
import { notifyShell } from '@/services/nasShell';
import { imageWork } from '@/services/imageWork';
import { IMAGE_DOCUMENT_TYPE, readImageDocument } from '@/services/imageDocument';

/** Load a selected NAS image only when the viewer needs its bytes. */
async function sourceFile(entry: ImageEntry, signal?: AbortSignal): Promise<File> {
  if (entry.file) {
    return entry.file;
  }
  if (!entry.source) {
    throw new ImageClientError('invalid_input');
  }
  const response = await fetch(entry.source.url, { signal });
  if (!response.ok) {
    throw new ImageClientError('unavailable');
  }
  const blob = await response.blob();
  if (blob.size > 30 * 1024 * 1024) {
    throw new ImageClientError('file_too_large');
  }
  entry.file = new File([blob], entry.name, { type: blob.type, lastModified: 0 });
  return entry.file;
}

function query(edits: ImageEdits, format: ExportFormat) {
  const values = new URLSearchParams({
    rotation: String(edits.rotation),
    flipHorizontal: String(edits.flipHorizontal),
    flipVertical: String(edits.flipVertical),
    brightness: String(edits.brightness),
    contrast: String(edits.contrast),
    sharpness: String(edits.sharpness),
    format,
  });
  if (edits.crop) {
    for (const [key, value] of Object.entries(edits.crop)) {
      values.set(`crop${key[0]?.toUpperCase()}${key.slice(1)}`, String(value));
    }
  }
  return values;
}

/** Post the original, prefixed by its length when an annotation layer follows it. */
async function post(
  entry: ImageEntry,
  edits: ImageEdits,
  format: ExportFormat,
  action: 'render' | 'export' | 'export_overlay',
  signal?: AbortSignal,
  overlay?: Uint8Array,
) {
  const file = await sourceFile(entry, signal);
  let body: Blob = file;
  if (overlay) {
    const length = new Uint8Array(4);
    new DataView(length.buffer).setUint32(0, file.size, true);
    body = new Blob([length, file, new Uint8Array(overlay)]);
  }
  const response = await fetch(`api/images/${action}?${query(edits, format)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', Accept: IMAGE_DOCUMENT_TYPE },
    body,
    signal,
  });

  if (!response.ok) {
    const body: unknown = await response.json();
    const code = body && typeof body === 'object' && 'error' in body ? body.error : 'unavailable';
    throw new ImageClientError(imageError(code));
  }

  return response;
}

export async function renderImage(
  entry: ImageEntry,
  edits: ImageEdits,
  signal?: AbortSignal,
): Promise<ImageDocument> {
  return imageWork(async () => {
    const response = await post(entry, edits, 'png', 'render', signal);
    return readImageDocument(await response.arrayBuffer());
  }, signal);
}

export function exportName(name: string, format: ExportFormat) {
  return `${name.replace(/\.[^.]+$/, '')}_edited.${format === 'jpeg' ? 'jpg' : format}`;
}

/** Export the edited copy and download it, returning its file name. */
export async function saveImage(
  entry: ImageEntry,
  edits: ImageEdits,
  format: ExportFormat,
  overlay?: Uint8Array,
): Promise<string | null> {
  const response = await imageWork(() =>
    post(entry, edits, format, overlay ? 'export_overlay' : 'export', undefined, overlay),
  );

  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  const name = exportName(entry.name, format);

  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notifyShell({ title: t('edit.download.started'), message: name, tone: 'success' });

  return name;
}

export const platform: ImagePlatform = {
  async inspectImage(entry, signal) {
    return imageWork(async () => {
      const file = await sourceFile(entry, signal);
      if (file.size > 30 * 1024 * 1024) {
        throw new ImageClientError('file_too_large');
      }

      const response = await fetch('api/images/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', Accept: IMAGE_DOCUMENT_TYPE },
        body: file,
        signal,
      });

      if (!response.ok) {
        const body: unknown = await response.json();
        throw new ImageClientError(
          imageError(
            body && typeof body === 'object' && 'error' in body ? body.error : 'unavailable',
          ),
        );
      }

      const document = readImageDocument(await response.arrayBuffer());
      document.info.name = entry.name;
      document.info.modified = file.lastModified || null;
      if (entry.source) {
        document.info.folder =
          entry.source.path.slice(0, entry.source.path.lastIndexOf('/')) || '/';
      }

      return document;
    }, signal);
  },
  renderImage,
  saveImage,
};
