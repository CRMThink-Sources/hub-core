import type {
  IBX24MessageEvent,
  IBX24MessageUpdateEvent,
} from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { BitrixEventHandler } from '../bitrix-event-handler'
import { enqueueThinkzapInboundJob } from '@/queue/thinkzap-inbound.queue'
import { apiLogger } from '@/shared/infra/logger'
import { randomUUID } from 'crypto'

/**
 * `ONIMCONNECTORMESSAGEUPDATE`: o operador editou uma mensagem no Contact Center.
 *
 * Só enfileira — a chamada ao provedor roda no worker, para o webhook responder
 * rápido e a falha da Z-API não virar reentrega do Bitrix.
 *
 * **Sem `jobId` determinístico**, ao contrário da mensagem recebida: o `message_id`
 * é o mesmo do evento `ADD` da mesma mensagem, e o BullMQ devolveria o job antigo em
 * vez de criar o da edição. A mesma mensagem também pode ser editada mais de uma vez.
 */
export class BitrixMessageUpdateHandler implements BitrixEventHandler {
  eventType = 'ONIMCONNECTORMESSAGEUPDATE'

  async handle(event: IBX24MessageEvent): Promise<void> {
    const updateEvent = event as unknown as IBX24MessageUpdateEvent
    const traceKey = randomUUID()
    apiLogger.info(
      {
        app: 'thinkzap',
        source: 'bitrix',
        domain: updateEvent.auth?.domain,
        line: updateEvent.data?.LINE,
        messagesCount: updateEvent.data?.MESSAGES?.length ?? 0,
        traceKey,
      },
      'Bitrix message update event received — enqueueing',
    )

    await enqueueThinkzapInboundJob({
      source: 'bitrix',
      type: this.eventType,
      body: updateEvent as unknown as Record<string, unknown>,
      traceKey,
    })
  }
}
