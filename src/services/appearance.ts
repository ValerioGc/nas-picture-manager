import { setTheme } from '@/composables/useTheme';
import { setLocale } from '@/i18n';

/** Apply the theme and language passed in the URL in standalone mode. */
export function initializeAppearance(search = window.location.search) {
  const parameters = new URLSearchParams(search);
  setTheme(parameters.get('theme') === 'light' ? 'light' : 'dark');
  setLocale(parameters.get('lang') === 'en' ? 'en' : 'it');
}
