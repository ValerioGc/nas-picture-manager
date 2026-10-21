import { describe, expect, it } from 'vitest';
import { readImageDocument, previewBlob } from '@/services/imageDocument';
import { imageDocument, imagePacket } from '@tests/fixtures';

describe('binary image documents', () => {
  it('reads Unicode metadata and uses a view of the raw preview buffer', () => {
    const source = imageDocument('città 🌅.png');
    const packet = imagePacket(source);
    const result = readImageDocument(packet);
    expect(result.info).toEqual(source.info);
    expect(Array.from(result.preview)).toEqual(source.preview);
    expect((result.preview as Uint8Array).buffer).toBe(packet);
    expect(previewBlob(result).size).toBe(source.preview.length);
  });

  it('rejects truncated envelopes, forged lengths and invalid metadata', () => {
    const oversized = imagePacket();
    new DataView(oversized).setUint32(0, 0xffffffff, true);
    const invalid = imageDocument();
    invalid.info.width = 0;
    for (const packet of [
      new ArrayBuffer(0),
      new ArrayBuffer(4),
      oversized,
      imagePacket(invalid),
      imagePacket().slice(0, 20),
    ]) {
      expect(() => readImageDocument(packet)).toThrow('invalid_image');
    }
  });
});
