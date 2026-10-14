import type { ImageDocument } from '@/types/types';

export function imageDocument(name = 'photo.png'): ImageDocument {
  return {
    info: {
      name,
      folder: 'Pictures',
      width: 640,
      height: 480,
      format: 'PNG',
      hasAlpha: true,
      size: 2048,
      created: null,
      modified: 1700000000000,
    },
    preview: [137, 80, 78, 71],
  };
}

export function imagePacket(document = imageDocument()): ArrayBuffer {
  const metadata = new TextEncoder().encode(JSON.stringify(document.info));
  const bytes = new Uint8Array(4 + metadata.length + document.preview.length);
  new DataView(bytes.buffer).setUint32(0, metadata.length, true);
  bytes.set(metadata, 4);
  bytes.set(document.preview, 4 + metadata.length);
  return bytes.buffer;
}
