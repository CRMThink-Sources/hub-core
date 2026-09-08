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
  if (event.isEdit) return `zapi-edit-${event.editMessageId}`
  if (event.notification === 'REVOKE') return `zapi-revoke-${event.messageId}`
  return `zapi-${event.messageId}`
}

export class ReceivedMessageHandler implements ZApiEventHandler {
  eventType = 'ReceivedCallback'

  async handle(event: ReceivedMessageEvent): Promise<void> {
    if (event.fromMe) return

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
}
