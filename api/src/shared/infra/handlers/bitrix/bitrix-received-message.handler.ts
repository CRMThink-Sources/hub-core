import { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { BitrixEventHandler } from '../bitrix-event-handler'
import { enqueueThinkzapInboundJob } from '@/queue/thinkzap-inbound.queue'
import { apiLogger } from '@/shared/infra/logger'
import { randomUUID } from 'crypto'

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

    await enqueueThinkzapInboundJob({
      source: 'bitrix',
      type: this.eventType,
      body: event as unknown as Record<string, unknown>,
      traceKey,
    })
  }
}
