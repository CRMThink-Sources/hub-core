import { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { BitrixEventHandler } from '../bitrix-event-handler'
import { enqueueThinkzapInboundJob } from '@/queue/thinkzap-inbound.queue'
import { apiLogger } from '@/shared/infra/logger'
import { randomUUID } from 'crypto'

/**
 * `jobId` determinístico pra colapsar reentrega do mesmo evento no BullMQ,
 * derivado do `message_id` que o Bitrix atribui à mensagem do canal aberto.
 *
 * `undefined` quando o evento chega sem mensagens (`MESSAGES` vazio) — sem id
 * não há chave estável, e o enfileiramento cai no comportamento de hoje
 * (`jobId` aleatório do BullMQ), que o processor já trata sem falha.
 */
export function resolveBitrixInboundJobId(
  event: IBX24MessageEvent,
): string | undefined {
  const messageId = event.data.MESSAGES[0]?.im.message_id
  return messageId ? `bitrix-${messageId}` : undefined
}

export class BitrixReceivedMessageHandler implements BitrixEventHandler {
  eventType = 'ONIMCONNECTORMESSAGEADD'

  async handle(event: IBX24MessageEvent): Promise<void> {
    const traceKey = randomUUID()
    apiLogger.info(
      {
        app: 'thinkzap',
        source: 'bitrix',
        domain: event.auth.domain,
        line: event.data.LINE,
        messagesCount: event.data.MESSAGES.length,
        traceKey,
      },
      'Bitrix outbound message received — enqueueing',
    )

    await enqueueThinkzapInboundJob(
      {
        source: 'bitrix',
        type: this.eventType,
        body: event as unknown as Record<string, unknown>,
        traceKey,
      },
      { jobId: resolveBitrixInboundJobId(event) },
    )
  }
}
