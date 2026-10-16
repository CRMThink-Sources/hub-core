/**
 * Idioma dos avisos que o servidor do ThinkZap gera sem tela aberta (chat do canal
 * aberto, timeline do CRM, sininho, histórico). Vem de `core_apps.locale`, escolhido no
 * menu do app; instalação sem escolha fica em português.
 */
export const NOTICE_LOCALES = ['pt', 'en', 'es'] as const
export type NoticeLocale = (typeof NOTICE_LOCALES)[number]

export const DEFAULT_NOTICE_LOCALE: NoticeLocale = 'pt'

/** Qualquer valor fora dos três — inclusive nulo — vira português. */
export function parseNoticeLocale(raw: unknown): NoticeLocale {
  return (NOTICE_LOCALES as readonly unknown[]).includes(raw)
    ? (raw as NoticeLocale)
    : DEFAULT_NOTICE_LOCALE
}
