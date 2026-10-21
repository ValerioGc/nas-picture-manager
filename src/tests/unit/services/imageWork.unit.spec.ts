import { afterEach, describe, expect, it, vi } from 'vitest';
import { imageWork } from '@/services/imageWork';
import { ImageClientError } from '@/composables/imageErrors';

afterEach(() => vi.useRealTimers());

describe('image work admission', () => {
  it('serializes operations and skips queued work canceled before reading its input', async () => {
    let release: () => void = () => {};
    const first = imageWork(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await Promise.resolve();
    const controller = new AbortController();
    const operation = vi.fn(async () => 'obsolete');
    const obsolete = imageWork(operation, controller.signal);
    const rejection = expect(obsolete).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    const next = vi.fn(async () => 'current');
    const last = imageWork(next);
    expect(next).not.toHaveBeenCalled();
    release();
    await first;
    await rejection;
    expect(operation).not.toHaveBeenCalled();
    expect(await last).toBe('current');
  });

  it('retries busy work without retrying invalid images', async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new ImageClientError('busy'))
      .mockResolvedValueOnce('ready');
    const pending = imageWork(operation);
    await vi.advanceTimersByTimeAsync(200);
    expect(await pending).toBe('ready');
    expect(operation).toHaveBeenCalledTimes(2);
    const invalid = vi.fn().mockRejectedValue(new ImageClientError('invalid_image'));
    await expect(imageWork(invalid)).rejects.toMatchObject({ code: 'invalid_image' });
    expect(invalid).toHaveBeenCalledTimes(1);
  });

  it('stops waiting for a busy worker when its request is canceled', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const operation = vi.fn().mockRejectedValue(new ImageClientError('busy'));
    const pending = imageWork(operation, controller.signal);
    const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await rejection;
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
