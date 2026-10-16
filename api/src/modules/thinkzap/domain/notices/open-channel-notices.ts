import type { NoticeLocale } from './notice-locale'

/**
 * Avisos que o servidor posta no chat do canal aberto, para o operador.
 *
 * `Record<NoticeLocale, …>`: um idioma sem algum texto não compila. O pt é o texto
 * que já existia, palavra por palavra.
 */
export type OpenChannelNotices = {
  /** Janela de 24h fechada na linha oficial. */
  windowClosed: string
  /** Falha no envio de botões pela tela do canal aberto; `reason` aparece como veio. */
  buttonActionFailed: (reason: string) => string
  /** O motivo da falha de botões quando o código chegou corrompido. */
  buttonCodeCorrupted: string
  /** Resumo do bot na transferência: só a parte fixa; rótulos e respostas são do fluxo. */
  handoffSummaryTitle: string
  handoffSummaryNoAnswers: string
}

const NOTICES: Record<NoticeLocale, OpenChannelNotices> = {
  pt: {
    windowClosed:
      '⚠️ Sua mensagem não foi entregue: o contato não interage há mais de 24 horas ' +
      'e o WhatsApp Oficial só permite mensagem livre dentro dessa janela. ' +
      'Para retomar a conversa, é preciso enviar um template aprovado.',
    buttonActionFailed: reason =>
      `⚠️ O envio de botões não foi entregue: ${reason}`,
    buttonCodeCorrupted:
      'a mensagem chegou corrompida. Tente novamente pela tela de botões.',
    handoffSummaryTitle: 'Resumo do atendimento automático',
    handoffSummaryNoAnswers:
      'O cliente não respondeu nada antes da transferência.',
  },
  en: {
    windowClosed:
      '⚠️ Your message was not delivered: the contact has not interacted for more ' +
      'than 24 hours, and WhatsApp Official only allows free-form messages within ' +
      'that window. To resume the conversation, send an approved template.',
    buttonActionFailed: reason =>
      `⚠️ The button message was not delivered: ${reason}`,
    buttonCodeCorrupted:
      'the message arrived corrupted. Try again from the buttons screen.',
    handoffSummaryTitle: 'Automated service summary',
    handoffSummaryNoAnswers:
      'The customer did not answer anything before the transfer.',
  },
  es: {
    windowClosed:
      '⚠️ Su mensaje no fue entregado: el contacto no interactúa hace más de 24 ' +
      'horas y WhatsApp Oficial solo permite mensajes libres dentro de esa ventana. ' +
      'Para retomar la conversación, es necesario enviar una plantilla aprobada.',
    buttonActionFailed: reason =>
      `⚠️ El envío de botones no fue entregado: ${reason}`,
    buttonCodeCorrupted:
      'el mensaje llegó dañado. Intente de nuevo desde la pantalla de botones.',
    handoffSummaryTitle: 'Resumen de la atención automática',
    handoffSummaryNoAnswers:
      'El cliente no respondió nada antes de la transferencia.',
  },
}

export function openChannelNotices(locale: NoticeLocale): OpenChannelNotices {
  return NOTICES[locale]
}
