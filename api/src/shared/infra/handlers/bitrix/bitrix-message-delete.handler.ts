import type { IBX24MessageDeleteEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import type { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { BitrixEventHandler } from '../bitrix-event-handler'
import { enqueueThinkzapInboundJob } from '@/queue/thinkzap-inbound.queue'
import { apiLogger } from '@/shared/infra/logger'
import { randomUUID } from 'crypto'

export class BitrixMessageDeleteHandler implements BitrixEventHandler {
  eventType = 'ONIMCONNECTORMESSAGEDELETE'

  async handle(event: IBX24MessageEvent): Promise<void> {
    const deleteEvent = event as unknown as IBX24MessageDeleteEvent
    const traceKey = randomUUID()
    apiLogger.info(
      {
        app: 'thinkzap',
        source: 'bitrix',
        domain: deleteEvent.auth.domain,
        line: deleteEvent.data.LINE,
        messagesCount: deleteEvent.data.MESSAGES.length,
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
