import { imageError, ImageClientError } from '@/composables/imageErrors';

let pending: Promise<void> = Promise.resolve();

function pause(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, 200);

    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      abort();
    }
  });
}

/**
 * Serialize work before reading file buffers, skipping superseded queued previews.
 * @param operation The asynchronous operation to perform.
 * @param signal Optional AbortSignal to cancel the operation.
 * @returns A promise that resolves with the result of the operation.
 */
export function imageWork<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const task = pending.then(async () => {
    const deadline = Date.now() + 60_000;
    for (;;) {
      signal?.throwIfAborted();
      try {
        return await operation();
      } catch (cause: unknown) {
        if (imageError(cause) !== 'busy') {
          throw cause;
        }
        if (Date.now() >= deadline) {
          throw new ImageClientError('busy');
        }
        await pause(signal);
      }
    }
  });

  pending = task.then(
    () => undefined,
    () => undefined,
  );

  return task;
}
