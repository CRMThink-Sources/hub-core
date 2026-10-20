import { SendNotification } from '@/shared/data/contracts/send-notification'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'
import {
  DEFAULT_NOTICE_LOCALE,
  NoticeLocale,
  dailyLimitNotices,
} from '@/modules/thinkzap/domain/daily-limit-notices'
import { timelineNotices } from '@/modules/thinkzap/domain/notices/timeline-notices'

/** `daily-limit` é um `failed` com motivo conhecido: nada saiu, e o texto diz por quê. */
export type WidgetSendOutcome = 'failed' | 'unknown' | 'daily-limit'

export type NotifyWidgetSendOutcomeInput = {
  outcome: WidgetSendOutcome
  entity: string
  entityId: string
  destination: string
  text: string
  /** Idioma da instalação. Ausente, português. */
  locale?: NoticeLocale
}

/**
 * Os dois textos são diferentes de propósito.
 *
 * `failed` afirma que a mensagem não saiu — o operador pode reenviar sem pensar.
 * `unknown` **não afirma nada**: a mensagem pode ter sido entregue e a confirmação ter
 * se perdido. Usar o texto de `failed` nesse caso levaria o operador a reenviar, e o
 * contato leria a mesma coisa duas vezes; usar o de `unknown` para uma falha real
 * pediria uma conferência desnecessária. O custo do erro é assimétrico, e a redação
 * segue essa assimetria.
 */
const NOTICE_BY_OUTCOME: Record<
  WidgetSendOutcome,
  (destination: string, text: string, locale: NoticeLocale) => string
> = {
  failed: (destination, text, locale) =>
    timelineNotices(locale).widgetFailed(destination, text),
  unknown: (destination, text, locale) =>
    timelineNotices(locale).widgetUnknown(destination, text),
  'daily-limit': (destination, text, locale) =>
    dailyLimitNotices(locale).queuedRefused(destination, text),
}

/**
 * Avisa o operador, na timeline da entidade do CRM, que um envio pelo widget terminou
 * mal.
 *
 * **Timeline e não chat do canal aberto.** O widget vive na aba de um deal, contato ou
 * lead, é para lá que o operador volta, e a timeline não depende de existir conversa
 * aberta — que é justamente o cenário do envio inicial que falha. O caminho de bot no
 * chat (`imbot.message.add`, usado por `notifyOperatorWindowClosed`) serve quem já
 * está no chat, e este operador pode nunca ter chegado lá.
 *
 * **Nunca lança.** O job já vai encerrar; falhar aqui transformaria um aviso perdido em
 * job falho, que o BullMQ retentaria — e a retentativa republicaria o aviso, porque
 * `crm.timeline.comment.add` não é idempotente.
 */
export async function notifyWidgetSendOutcome(
  sendNotification: SendNotification,
  input: NotifyWidgetSendOutcomeInput,
): Promise<void> {
  const {
    outcome,
    entity,
    entityId,
    destination,
    text,
    locale = DEFAULT_NOTICE_LOCALE,
  } = input

  try {
    await sendNotification.execute({
      contextId: entityId,
      entity,
      message: NOTICE_BY_OUTCOME[outcome](destination, text, locale),
    })

    apiLogger.info(
      { app: 'thinkzap', entity, entityId, outcome, sendOutcomeNotified: true },
      'Operador avisado sobre o desfecho do envio pelo widget',
    )
  } catch (err) {
    logThinkzapError(
      apiLogger,
      'thinkzap.message.widget_send_notice_failed',
      { app: 'thinkzap', entity, entityId, outcome, err },
      {
        level: 'warn',
        msg: 'Não foi possível avisar o operador sobre o desfecho do envio',
      },
    )
  }
}
