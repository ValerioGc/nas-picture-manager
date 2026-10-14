import { ref } from 'vue';
import en from '@/i18n/locales/en';
import it from '@/i18n/locales/it';

export const messages = { en, it } as const;
export type SupportedLocale = keyof typeof messages;
export type MessageKey = keyof typeof en;

const locale = ref<SupportedLocale>('it');

export function setLocale(nextLocale: SupportedLocale) {
  locale.value = nextLocale;
  document.documentElement.lang = nextLocale;
}

export function t(key: MessageKey) {
  return messages[locale.value][key] ?? messages.en[key];
}

export function useI18n() {
  const number = (value: number, options?: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat(locale.value, options).format(value);

  const date = (value: number | null) =>
    value === null
      ? t('info.unknown')
      : new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(
          value,
        );

  return { locale, setLocale, t, number, date };
}
