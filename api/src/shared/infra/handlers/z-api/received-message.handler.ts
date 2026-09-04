import { ZApiEventHandler } from '../z-api-event-handler'
import { ReceivedMessageEvent } from './z-api'
import { enqueueThinkzapInboundJob } from '@/queue/thinkzap-inbound.queue'
import { apiLogger } from '@/shared/infra/logger'
import { randomUUID } from 'crypto'

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
    await enqueueThinkzapInboundJob({
      source: 'z-api',
      type: 'received-message',
      body: event,
      traceKey,
    })
  }
}
