import type { NoticeLocale } from './notice-locale'

/**
 * Notificações de conexão da linha, no sininho do Bitrix, por idioma. O motivo da
 * desconexão vem do provedor e aparece como veio. O pt é o texto que já existia.
 */
export type ConnectionNotices = {
  /** Alvo da notificação: com telefone conhecido, ou o genérico. */
  target: (phone: string | undefined) => string
  connected: (target: string, instanceId: string) => string
  disconnected: (
    target: string,
    instanceId: string,
    error: string | undefined,
  ) => string
}

const NOTICES: Record<NoticeLocale, ConnectionNotices> = {
  pt: {
    target: phone => (phone ? `WhatsApp ${phone}` : `WhatsApp do Thinkzap`),
    connected: (target, instanceId) =>
      `O ${target} (instância ${instanceId}) foi conectado com sucesso.`,
    disconnected: (target, instanceId, error) =>
      error
        ? `O ${target} (instância ${instanceId}) foi desconectado: ${error}. Reconecte o quanto antes.`
        : `O ${target} (instância ${instanceId}) foi desconectado. Reconecte o quanto antes.`,
  },
  en: {
    target: phone => (phone ? `WhatsApp ${phone}` : `Thinkzap WhatsApp`),
    connected: (target, instanceId) =>
      `${target} (instance ${instanceId}) was connected successfully.`,
    disconnected: (target, instanceId, error) =>
      error
        ? `${target} (instance ${instanceId}) was disconnected: ${error}. Reconnect as soon as possible.`
        : `${target} (instance ${instanceId}) was disconnected. Reconnect as soon as possible.`,
  },
  es: {
    target: phone => (phone ? `WhatsApp ${phone}` : `WhatsApp de Thinkzap`),
    connected: (target, instanceId) =>
      `El ${target} (instancia ${instanceId}) se conectó con éxito.`,
    disconnected: (target, instanceId, error) =>
      error
        ? `El ${target} (instancia ${instanceId}) se desconectó: ${error}. Vuelva a conectarlo lo antes posible.`
        : `El ${target} (instancia ${instanceId}) se desconectó. Vuelva a conectarlo lo antes posible.`,
  },
}

export function connectionNotices(locale: NoticeLocale): ConnectionNotices {
  return NOTICES[locale]
}
