import type { IBX24MessageUpdateEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import type { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { BitrixEventHandler } from '../bitrix-event-handler'
import { enqueueThinkzapInboundJob } from '@/queue/thinkzap-inbound.queue'
import { apiLogger } from '@/shared/infra/logger'
import { randomUUID } from 'crypto'

export class BitrixMessageUpdateHandler implements BitrixEventHandler {
  eventType = 'ONIMCONNECTORMESSAGEUPDATE'

  async handle(event: IBX24MessageEvent): Promise<void> {
    const updateEvent = event as unknown as IBX24MessageUpdateEvent
    const traceKey = randomUUID()
    apiLogger.info(
      {
        app: 'thinkzap',
        source: 'bitrix',
        domain: updateEvent.auth.domain,
        line: updateEvent.data.LINE,
        messagesCount: updateEvent.data.MESSAGES.length,
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
