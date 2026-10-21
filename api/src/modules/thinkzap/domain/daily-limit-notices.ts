/**
 * Textos dos avisos do limite diário, no idioma da instalação.
 *
 * Gerados no servidor, sem tela aberta (worker, robô, envio síncrono): o idioma vem do
 * que foi escolhido no app e gravado em `core_apps.locale`, não do navegador de quem
 * está olhando. Instalação que nunca escolheu fica em português, como antes.
 */

import type { NoticeLocale } from './notices/notice-locale'

// O idioma é dos avisos do servidor em geral; reexportado para os chamadores do limite.
export {
  DEFAULT_NOTICE_LOCALE,
  NOTICE_LOCALES,
  parseNoticeLocale,
} from './notices/notice-locale'
export type { NoticeLocale } from './notices/notice-locale'

type DailyLimitNotices = {
  /** Aviso no chat do canal aberto, para o operador que respondeu. */
  chat: string
  /** Comentário de timeline da mensagem que estava na fila e foi recusada. */
  queuedRefused: (destination: string, text: string) => string
  /** Linha acrescentada à timeline do envio com anexo interrompido pelo limite. */
  attachmentsSkipped: (count: number) => string
  /** Linha acrescentada à timeline do robô "Enviar mensagem". */
  robotRefused: (phones: string[]) => string
}

const NOTICES: Record<NoticeLocale, DailyLimitNotices> = {
  pt: {
    chat:
      '⚠️ Sua mensagem não foi entregue: esta linha atingiu o limite diário de ' +
      'mensagens configurado no ThinkZap. Os envios voltam na virada do dia, ou ' +
      'antes, se o limite for aumentado ou um limite temporário for liberado na ' +
      'aba Limites de envio da linha.',
    queuedRefused: (destination, text) =>
      '⚠️ A mensagem abaixo NÃO foi entregue: a linha atingiu o limite diário de mensagens.\n' +
      `Para: ${destination}\n` +
      `Mensagem: ${text}\n` +
      'Ela não será reenviada automaticamente. Os envios voltam na virada do dia, ou antes, ' +
      'se o limite for aumentado ou um limite temporário for liberado na aba Limites de envio da linha.',
    attachmentsSkipped: count =>
      `⚠️ ${count} anexo(s) NÃO enviado(s): a linha atingiu o limite diário de mensagens.`,
    robotRefused: phones =>
      `⚠️ NÃO enviado (limite diário da linha atingido): ${phones.join(', ')}`,
  },
  en: {
    chat:
      '⚠️ Your message was not delivered: this line has reached the daily message ' +
      'limit set in ThinkZap. Sending resumes when the day turns over, or sooner if ' +
      'the limit is raised or a temporary limit is released in the line Sending limits tab.',
    queuedRefused: (destination, text) =>
      '⚠️ The message below was NOT delivered: the line has reached its daily message limit.\n' +
      `To: ${destination}\n` +
      `Message: ${text}\n` +
      'It will not be resent automatically. Sending resumes when the day turns over, or sooner ' +
      'if the limit is raised or a temporary limit is released in the line Sending limits tab.',
    attachmentsSkipped: count =>
      `⚠️ ${count} attachment(s) NOT sent: the line has reached its daily message limit.`,
    robotRefused: phones =>
      `⚠️ NOT sent (line daily limit reached): ${phones.join(', ')}`,
  },
  es: {
    chat:
      '⚠️ Su mensaje no fue entregado: esta línea alcanzó el límite diario de ' +
      'mensajes configurado en ThinkZap. Los envíos vuelven con el cambio de día, o ' +
      'antes, si se aumenta el límite o se libera un límite temporal en la pestaña ' +
      'Límites de envío de la línea.',
    queuedRefused: (destination, text) =>
      '⚠️ El mensaje de abajo NO fue entregado: la línea alcanzó el límite diario de mensajes.\n' +
      `Para: ${destination}\n` +
      `Mensaje: ${text}\n` +
      'No se reenviará automáticamente. Los envíos vuelven con el cambio de día, o antes, ' +
      'si se aumenta el límite o se libera un límite temporal en la pestaña Límites de envío de la línea.',
    attachmentsSkipped: count =>
      `⚠️ ${count} adjunto(s) NO enviado(s): la línea alcanzó el límite diario de mensajes.`,
    robotRefused: phones =>
      `⚠️ NO enviado (límite diario de la línea alcanzado): ${phones.join(', ')}`,
  },
}

export function dailyLimitNotices(locale: NoticeLocale): DailyLimitNotices {
  return NOTICES[locale]
}
