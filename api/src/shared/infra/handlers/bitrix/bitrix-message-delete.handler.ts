import type {
  IBX24MessageDeleteEvent,
  IBX24MessageEvent,
} from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { BitrixEventHandler } from '../bitrix-event-handler'
import { enqueueThinkzapInboundJob } from '@/queue/thinkzap-inbound.queue'
import { apiLogger } from '@/shared/infra/logger'
import { randomUUID } from 'crypto'

/**
 * `ONIMCONNECTORMESSAGEDELETE`: o operador excluiu uma mensagem no Contact Center.
 *
 * Só enfileira, pelo mesmo motivo do handler de edição — e também sem `jobId`
 * determinístico, porque o `message_id` colidiria com o job do evento `ADD`.
 */
export class BitrixMessageDeleteHandler implements BitrixEventHandler {
  eventType = 'ONIMCONNECTORMESSAGEDELETE'

  async handle(event: IBX24MessageEvent): Promise<void> {
    const deleteEvent = event as unknown as IBX24MessageDeleteEvent
    const traceKey = randomUUID()
    apiLogger.info(
      {
        app: 'thinkzap',
        source: 'bitrix',
        domain: deleteEvent.auth?.domain,
        line: deleteEvent.data?.LINE,
        messagesCount: deleteEvent.data?.MESSAGES?.length ?? 0,
        traceKey,
      },
      'Bitrix message delete event received — enqueueing',
    )

    await enqueueThinkzapInboundJob({
      source: 'bitrix',
      type: this.eventType,
      body: deleteEvent as unknown as Record<string, unknown>,
      traceKey,
    })
  }
}
