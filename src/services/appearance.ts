import { setTheme } from '@/composables/useTheme';
import { setLocale } from '@/i18n';

/**
 * Browser embedding options
 * @param {string} search - The URL search string to parse for appearance settings.
 * @returns {void} - Initializes the appearance settings based on the URL search parameters.
 */
export function initializeAppearance(search = window.location.search) {
  const parameters = new URLSearchParams(search);
  setTheme(parameters.get('theme') === 'light' ? 'light' : 'dark');
  setLocale(parameters.get('lang') === 'en' ? 'en' : 'it');
}
