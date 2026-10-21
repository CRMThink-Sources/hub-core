import type { NoticeLocale } from './notice-locale'

/**
 * Avisos da cadência de envio que o servidor posta no chat do canal aberto, por
 * idioma. O horário sai em `America/Sao_Paulo`, no formato HH:mm.
 */
export type CadenceNotices = {
  /** A resposta do operador está na fila, esperando a janela de envio da linha. */
  operatorWaiting: (retryAt: number) => string
}

export const CADENCE_NOTICE_TIME_ZONE = 'America/Sao_Paulo'

/** HH:mm no fuso da operação, igual para os três idiomas. */
export function formatCadenceTime(epochMs: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: CADENCE_NOTICE_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(epochMs))
}

const NOTICES: Record<NoticeLocale, CadenceNotices> = {
  pt: {
    operatorWaiting: retryAt =>
      '⏳ Sua mensagem está aguardando a janela de envio desta linha (cadenciador) ' +
      `e deve sair às ${formatCadenceTime(retryAt)}. Não é preciso reenviar.`,
  },
  en: {
    operatorWaiting: retryAt =>
      "⏳ Your message is waiting for this line's sending window (cadence) " +
      `and should go out at ${formatCadenceTime(retryAt)}. No need to resend it.`,
  },
  es: {
    operatorWaiting: retryAt =>
      '⏳ Tu mensaje está esperando la ventana de envío de esta línea (cadenciador) ' +
      `y debería salir a las ${formatCadenceTime(retryAt)}. No es necesario reenviarlo.`,
  },
}

export function cadenceNotices(locale: NoticeLocale): CadenceNotices {
  return NOTICES[locale]
}
