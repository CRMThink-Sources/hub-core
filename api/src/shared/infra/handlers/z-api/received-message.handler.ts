import { ZApiEventHandler } from '../z-api-event-handler'
import { ReceivedMessageEvent } from './z-api'
import { enqueueThinkzapInboundJob } from '@/queue/thinkzap-inbound.queue'
import { apiLogger } from '@/shared/infra/logger'
import { randomUUID } from 'crypto'

/**
 * `jobId` determinístico pra colapsar reentrega do mesmo evento no BullMQ.
 *
 * A Z-API reusa `messageId` entre envio, edição e remoção da mesma mensagem —
 * `event.messageId` sozinho colidiria o job de edição com o do envio original.
 * A operação entra na chave por isso: são eventos distintos sobre o mesmo
 * `messageId`, não a mesma entrega reenviada.
 *
 * `:` fica de fora de propósito — BullMQ rejeita ("Custom Id cannot contain :").
 */
export function resolveZApiInboundJobId(event: ReceivedMessageEvent): string {
  // Namespace próprio para o enviado pelo aparelho: o `messageId` é do mesmo espaço
  // do inbound, e colidir colapsaria eventos de significados diferentes.
  const prefix = event.fromMe ? 'zapi-me' : 'zapi'
  if (event.isEdit) return `${prefix}-edit-${event.editMessageId}`
  if (event.notification === 'REVOKE') {
    return `${prefix}-revoke-${event.messageId}`
  }
  return `${prefix}-${event.messageId}`
}

/** `type` do job de mensagem enviada pelo próprio aparelho (celular/WhatsApp Web). */
export const ZAPI_SENT_BY_ME_JOB_TYPE = 'sent-by-me'

export class ReceivedMessageHandler implements ZApiEventHandler {
  eventType = 'ReceivedCallback'

  async handle(event: ReceivedMessageEvent): Promise<void> {
    if (event.fromMe) {
      await this.handleSentByMe(event)
      return
    }

    const traceKey = randomUUID()
    apiLogger.info(
      {
        event: 'webhook.received',
        app: 'thinkzap',
        source: 'z-api',
        eventType: this.eventType,
        instanceId: event.instanceId,
        messageId: event.messageId,
        phone: event.phone,
        isGroup: event.isGroup,
        hasImage: Boolean(event.image),
        hasAudio: Boolean(event.audio),
        hasVideo: Boolean(event.video),
        traceKey,
      },
      'Received Z-API message event',
    )

    // if (this.checkIfMessageIsFromGroupOrNewsletter(event)) return
    await enqueueThinkzapInboundJob(
      {
        source: 'z-api',
        type: 'received-message',
        body: event,
        traceKey,
      },
      { jobId: resolveZApiInboundJobId(event) },
    )
  }

  /**
   * Enviada pelo próprio número. Só chega com `notifySentByMe` ligado na instância,
   * que é o toggle de espelhamento da linha.
   *
   * `fromApi` descarta aqui, sem I/O: é a mensagem que **nós** mandamos (canal aberto,
   * widget, robôs) voltando — ela já está no Bitrix. O toggle não é checado aqui: exige
   * resolver o item da SPA, e o webhook tem de responder rápido; o worker checa.
   */
  private async handleSentByMe(event: ReceivedMessageEvent): Promise<void> {
    if (event.fromApi) {
      apiLogger.debug(
        {
          app: 'thinkzap',
          source: 'z-api',
          instanceId: event.instanceId,
          messageId: event.messageId,
          fromMe: true,
          fromApi: true,
        },
        'Z-API message sent through the API — discarding',
      )
      return
    }

    const traceKey = randomUUID()
    apiLogger.info(
      {
        event: 'webhook.received',
        app: 'thinkzap',
        source: 'z-api',
        eventType: this.eventType,
        instanceId: event.instanceId,
        messageId: event.messageId,
        phone: event.phone,
        isGroup: event.isGroup,
        fromMe: true,
        traceKey,
      },
      'Received Z-API message sent from the device',
    )

    await enqueueThinkzapInboundJob(
      {
        source: 'z-api',
        type: ZAPI_SENT_BY_ME_JOB_TYPE,
        body: event,
        traceKey,
      },
      { jobId: resolveZApiInboundJobId(event) },
    )
  }
}
