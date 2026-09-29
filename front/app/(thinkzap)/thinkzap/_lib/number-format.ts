const NUMBER_LOCALES: Record<string, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
}

/**
 * Locale do `Intl` para o idioma do i18next. Aceita variantes (`en-US`) pelo
 * prefixo; idioma desconhecido cai em `pt-BR`, o padrão do app.
 */
export function numberLocaleFor(language: string | undefined): string {
  const base = language?.split('-')[0] ?? ''
  return NUMBER_LOCALES[base] ?? NUMBER_LOCALES.pt
}

export function createNumberFormatter(
  language: string | undefined,
): Intl.NumberFormat {
  return new Intl.NumberFormat(numberLocaleFor(language))
}
