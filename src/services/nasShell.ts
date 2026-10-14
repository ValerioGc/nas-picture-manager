import { setTheme } from '@/composables/useTheme';
import { randomUuid } from '@valeriogc/nas-base-app';
import { setLocale } from '@/i18n';
import type { FilePickerOptions, FileSelection, PickedFile } from '@/types/types';

interface Notification {
  title: string;
  message?: string;
  tone?: 'info' | 'success' | 'warning' | 'error';
}

let shellOrigin: string | null = null;
const pendingFiles = new Map<string, (result: FileSelection) => void>();

function pickedFile(value: unknown): value is PickedFile {
  if (
    !value ||
    typeof value !== 'object' ||
    !('name' in value) ||
    typeof value.name !== 'string' ||
    !value.name ||
    !('path' in value) ||
    typeof value.path !== 'string' ||
    !value.path.startsWith('/') ||
    !('url' in value) ||
    typeof value.url !== 'string'
  ) {
    return false;
  }
  try {
    const url = new URL(value.url);
    return url.origin === window.location.origin && /^\/apps\/[\w-]+\/api\//.test(url.pathname);
  } catch {
    return false;
  }
}

/** Ask the launcher for its installed NAS file selector, with no browser-dialog fallback. */
export function pickNasFiles(options: FilePickerOptions = {}): Promise<FileSelection> {
  if (window.parent === window) {
    return Promise.resolve({ files: [], cancelled: false, error: 'Launcher unavailable' });
  }
  const requestId = randomUuid();
  return new Promise((resolve) => {
    pendingFiles.set(requestId, resolve);
    window.parent.postMessage(
      { nas: 1, type: 'pick-files', requestId, ...options },
      window.location.origin,
    );
  });
}

const PALETTE_TOKENS = {
  background: '--nas-background',
  foreground: '--nas-foreground',
  surface: '--nas-surface',
  sunken: '--nas-sunken',
  hover: '--nas-hover',
  border: '--nas-border',
  muted: '--nas-muted',
} as const;

/** Each launcher colour maps to the token with the same role; missing colours use local defaults. */
function applyPalette(palette: unknown) {
  const style = document.documentElement.style;
  const colours =
    palette && typeof palette === 'object' ? (palette as Record<string, unknown>) : {};
  for (const [role, token] of Object.entries(PALETTE_TOKENS)) {
    const value = colours[role];
    if (typeof value === 'string' && CSS.supports('color', value)) {
      style.setProperty(token, value);
    } else {
      style.removeProperty(token);
    }
  }
}

function receiveFileSelection(message: object) {
  if (!('requestId' in message) || typeof message.requestId !== 'string') {
    return;
  }
  const resolve = pendingFiles.get(message.requestId);
  if (!resolve) {
    return;
  }
  pendingFiles.delete(message.requestId);
  if (
    !('cancelled' in message) ||
    typeof message.cancelled !== 'boolean' ||
    !('files' in message) ||
    !Array.isArray(message.files) ||
    message.files.length > 100 ||
    !message.files.every(pickedFile) ||
    ('error' in message && typeof message.error !== 'string')
  ) {
    resolve({ files: [], cancelled: false, error: 'Invalid file selection' });
    return;
  }
  resolve({
    files: message.cancelled ? [] : message.files,
    cancelled: message.cancelled,
    ...('error' in message ? { error: message.error as string } : {}),
  });
}

function receiveContext(context: unknown, origin: string) {
  if (!context || typeof context !== 'object') {
    return;
  }
  if (!('theme' in context) || (context.theme !== 'light' && context.theme !== 'dark')) {
    return;
  }
  if (!('locale' in context) || (context.locale !== 'it' && context.locale !== 'en')) {
    return;
  }
  if (!('accent' in context) || typeof context.accent !== 'string') {
    return;
  }

  shellOrigin = origin;
  document.documentElement.dataset.nasShell = 'true';
  setTheme(context.theme);
  setLocale(context.locale);
  const style = document.documentElement.style;
  if (context.accent && CSS.supports('color', context.accent)) {
    style.setProperty('--accent', context.accent);
    style.setProperty('--accent-soft', 'color-mix(in srgb, var(--accent) 20%, var(--surface))');
  } else {
    style.removeProperty('--accent');
    style.removeProperty('--accent-soft');
  }
  applyPalette('palette' in context ? context.palette : undefined);
}

/** Accept context only from the embedding launcher on this same origin. */
export function initializeShell() {
  if (window.parent === window) {
    return () => {};
  }

  function receive(event: MessageEvent<unknown>) {
    if (event.source !== window.parent || event.origin !== window.location.origin) {
      return;
    }
    if (shellOrigin !== null && event.origin !== shellOrigin) {
      return;
    }
    const message = event.data;
    if (!message || typeof message !== 'object' || !('nas' in message) || message.nas !== 1) {
      return;
    }
    if ('type' in message && message.type === 'pick-files-result') {
      receiveFileSelection(message);
      return;
    }
    if (!('type' in message) || message.type !== 'context' || !('context' in message)) {
      return;
    }
    receiveContext(message.context, event.origin);
  }

  window.addEventListener('message', receive);
  window.parent.postMessage({ nas: 1, type: 'ready' }, window.location.origin);
  return () => {
    window.removeEventListener('message', receive);
    shellOrigin = null;
    for (const resolve of pendingFiles.values()) {
      resolve({ files: [], cancelled: true });
    }
    pendingFiles.clear();
  };
}

/** Notifications are delivered by the shell, never through its cross-origin HTTP API. */
export function notifyShell(notification: Notification) {
  if (shellOrigin === null) {
    return false;
  }
  window.parent.postMessage({ ...notification, nas: 1, type: 'notify' }, shellOrigin);
  return true;
}
