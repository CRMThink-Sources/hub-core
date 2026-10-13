import type { Locale } from '@/i18n/config'

/** Código do Bitrix (`BX24.getLang()`), não ISO: `la` é o espanhol. */
const BITRIX_LANG_TO_LOCALE: Record<string, Locale> = {
  br: 'pt',
  en: 'en',
  la: 'es',
}

/**
 * Idioma do app a partir do idioma do portal. `null` para idioma que o app não
 * tem — quem chama mantém o padrão.
 */
export function localeFromBitrixLang(
  lang: string | null | undefined,
): Locale | null {
  return BITRIX_LANG_TO_LOCALE[lang ?? ''] ?? null
}
