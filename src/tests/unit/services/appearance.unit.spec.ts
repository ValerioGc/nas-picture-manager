import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeAppearance } from '@/services/appearance';
import { setTheme } from '@/composables/useTheme';
import { setLocale } from '@/i18n';

vi.mock('@/composables/useTheme', () => ({ setTheme: vi.fn() }));
vi.mock('@/i18n', () => ({ setLocale: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

describe('appearance input parameters', () => {
  it.each([
    ['?theme=light&lang=en', 'light', 'en'],
    ['?theme=dark&lang=it', 'dark', 'it'],
    ['', 'dark', 'it'],
    ['?theme=invalid&lang=invalid', 'dark', 'it'],
  ])('configures browser appearance from %s', (search, theme, locale) => {
    initializeAppearance(search);

    expect(setTheme).toHaveBeenCalledWith(theme);
    expect(setLocale).toHaveBeenCalledWith(locale);
  });
});
