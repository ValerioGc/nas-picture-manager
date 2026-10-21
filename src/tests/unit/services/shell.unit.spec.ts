import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeShell, notifyShell, pickNasFiles } from '@/services/nasShell';
import { setTheme } from '@/composables/useTheme';
import { setLocale, t } from '@/i18n';

const origin = window.location.origin;
let dispose: (() => void) | undefined;
let parent: Window;
const postMessage = vi.fn();

function receive(data: unknown, source = parent, from = origin) {
  window.dispatchEvent(new MessageEvent('message', { data, source, origin: from }));
}

function context(theme = 'light', accent = '#336699', locale = 'en') {
  return { nas: 1, type: 'context', context: { theme, accent, locale } };
}

beforeEach(() => {
  parent = { postMessage } as unknown as Window;
  vi.stubGlobal('parent', parent);
  Object.defineProperty(document, 'referrer', {
    configurable: true,
    value: `${origin}/shell`,
  });
  vi.stubGlobal('CSS', { supports: (_property: string, color: string) => color === '#336699' });
  setTheme('dark');
  setLocale('it');
  dispose = initializeShell();
});

afterEach(() => {
  dispose?.();
  vi.unstubAllGlobals();
  delete (document as { referrer?: string }).referrer;
  vi.clearAllMocks();
  document.documentElement.removeAttribute('style');
  setTheme('dark');
  setLocale('it');
});

describe('NAS shell protocol', () => {
  it('requests NAS files with filters and accepts only the matching reply from the parent', async () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const pending = pickNasFiles({ multiple: true, extensions: ['.png'], directory: '/photos' });
    const message = postMessage.mock.lastCall?.[0] as { requestId: string };
    expect(message.requestId).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
    );
    expect(postMessage).toHaveBeenLastCalledWith(
      {
        nas: 1,
        type: 'pick-files',
        requestId: message.requestId,
        multiple: true,
        extensions: ['.png'],
        directory: '/photos',
      },
      origin,
    );
    const files = [
      {
        name: 'photo.png',
        path: '/photos/photo.png',
        url: `${origin}/apps/nas-file-manager/api/downloads?path=photos%2Fphoto.png`,
      },
    ];
    const reply = {
      nas: 1,
      type: 'pick-files-result',
      requestId: message.requestId,
      files,
      cancelled: false,
    };
    receive(reply, window);
    receive(reply, parent, 'https://other.example');
    receive({ ...reply, requestId: 'other-request' });
    receive({ ...reply, nas: 2 });
    receive(reply);
    await expect(pending).resolves.toEqual({ files, cancelled: false });
  });

  it.each(['https://other.example/file.png', `${origin}/auth/logout`, 'invalid-url'])(
    'rejects a file URL outside the NAS provider: %s',
    async (url) => {
      const pending = pickNasFiles();
      const { requestId } = postMessage.mock.lastCall?.[0] as { requestId: string };
      receive({
        nas: 1,
        type: 'pick-files-result',
        requestId,
        files: [{ name: 'photo.png', path: '/photo.png', url }],
        cancelled: false,
      });
      await expect(pending).resolves.toMatchObject({ files: [], error: 'Invalid file selection' });
    },
  );

  it('returns cancellation and provider errors, and settles pending requests on disposal', async () => {
    const cancelled = pickNasFiles();
    const first = postMessage.mock.lastCall?.[0] as { requestId: string };
    receive({
      nas: 1,
      type: 'pick-files-result',
      requestId: first.requestId,
      files: [],
      cancelled: true,
    });
    await expect(cancelled).resolves.toEqual({ files: [], cancelled: true });
    const unavailable = pickNasFiles();
    const second = postMessage.mock.lastCall?.[0] as { requestId: string };
    receive({
      nas: 1,
      type: 'pick-files-result',
      requestId: second.requestId,
      files: [],
      cancelled: false,
      error: 'Provider unavailable',
    });
    await expect(unavailable).resolves.toMatchObject({ files: [], error: 'Provider unavailable' });
    const disposed = pickNasFiles();
    dispose?.();
    await expect(disposed).resolves.toEqual({ files: [], cancelled: true });
    vi.stubGlobal('parent', window);
    await expect(pickNasFiles()).resolves.toMatchObject({ error: 'Launcher unavailable' });
  });
  it('announces readiness then applies live theme, accent and translated labels', () => {
    expect(postMessage).toHaveBeenCalledWith({ nas: 1, type: 'ready' }, origin);

    receive(context());

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('normal');
    expect(document.documentElement.lang).toBe('en');
    expect(t('viewer.open')).toBe('Open file');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#336699');

    receive(context('dark', '', 'it'));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(t('viewer.open')).toBe('Apri file');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--accent-soft')).toBe('');
  });

  it('ignores unrelated frames, opaque origins, malformed context and protocol versions', () => {
    receive(context(), window);
    receive(context(), parent, 'null');

    for (const message of [
      null,
      {},
      { ...context(), nas: 2 },
      { ...context(), type: 'notify' },
      { ...context(), context: null },
      context('invalid'),
      context('light', '', 'xx'),
    ]) {
      receive(message);
    }

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.lang).toBe('it');
    expect(notifyShell({ title: 'No context yet' })).toBe(false);
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it('accepts only the launcher origin and sends notifications to that exact origin', () => {
    receive(context());
    receive(context('dark', '', 'it'), parent, 'http://other.example');

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(notifyShell({ title: 'Download started', message: 'image.png', tone: 'success' })).toBe(
      true,
    );
    expect(postMessage).toHaveBeenLastCalledWith(
      { nas: 1, type: 'notify', title: 'Download started', message: 'image.png', tone: 'success' },
      origin,
    );
  });

  it('applies every palette role live and clears missing or invalid colours', () => {
    const roles = ['background', 'foreground', 'surface', 'sunken', 'hover', 'border', 'muted'];
    receive({
      ...context(),
      context: {
        ...context().context,
        palette: Object.fromEntries(roles.map((role) => [role, '#336699'])),
      },
    });
    for (const role of roles) {
      expect(document.documentElement.style.getPropertyValue(`--nas-${role}`)).toBe('#336699');
    }
    receive({
      ...context('dark', 'url(evil)', 'it'),
      context: {
        ...context('dark', 'url(evil)', 'it').context,
        palette: { background: '#336699', foreground: 'url(evil)', surface: 1 },
      },
    });
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--nas-background')).toBe('#336699');
    for (const role of roles.slice(1)) {
      expect(document.documentElement.style.getPropertyValue(`--nas-${role}`)).toBe('');
    }
    receive(context());
    expect(document.documentElement.style.getPropertyValue('--nas-background')).toBe('');
  });

  it('announces readiness without depending on a referrer', () => {
    dispose?.();
    postMessage.mockClear();
    Object.defineProperty(document, 'referrer', { configurable: true, value: '' });
    dispose = initializeShell();
    expect(postMessage).toHaveBeenCalledWith({ nas: 1, type: 'ready' }, origin);
  });

  it('removes the listener and disables notifications when disposed', () => {
    receive(context());
    dispose?.();
    receive(context('dark', '', 'it'));

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(notifyShell({ title: 'Disposed' })).toBe(false);
  });

  it('keeps the standalone browser independent of the shell', () => {
    dispose?.();
    postMessage.mockClear();
    vi.stubGlobal('parent', window);
    dispose = initializeShell();
    receive(context(), window);

    expect(postMessage).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
