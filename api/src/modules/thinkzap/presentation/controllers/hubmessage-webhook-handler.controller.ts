import { randomUUID } from 'node:crypto'
import { Request, Response } from 'express'

import { enqueueThinkzapInboundJob } from '@/queue/thinkzap-inbound.queue'
import { httpResponse } from '@/shared/helpers/http'
import { apiLogger } from '@/shared/infra/logger'
import { Controller } from '@/shared/presentation/controller'
import { isHubMessageWebhookEnvelope } from '../../domain/interfaces/hubmessage-events.interface'

/**
 * Webhook `MESSAGE_RECEIVED` da HubMessage (WhatsApp Oficial).
 *
 * Responde 200 mesmo quando descarta o evento: um payload que nunca será
 * processado (envelope inválido, mensagem nossa) não deve ser reentregue
 * indefinidamente pela HubMessage.
 */
export class HubmessageWebhookHandlerController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const body: unknown = req.body

    if (!isHubMessageWebhookEnvelope(body)) {
      apiLogger.warn(
        { app: 'thinkzap', source: 'hubmessage', invalidEnvelope: true },
        'HubMessage webhook with unexpected payload — discarding',
      )
      return this.ok({ data: 'Webhook recebido' })
    }

    const { message, messageEventType } = body

    if (message.metadata?.from_me === true) {
      apiLogger.debug(
        {
          app: 'thinkzap',
          source: 'hubmessage',
          channelId: message.channel_id,
          messageId: message._id,
          fromMe: true,
        },
        'HubMessage message sent by the business — discarding',
      )
      return this.ok({ data: 'Webhook recebido' })
    }

    const traceKey = randomUUID()

    apiLogger.info(
      {
        app: 'thinkzap',
        source: 'hubmessage',
        eventType: messageEventType,
        channelId: message.channel_id,
        messageId: message._id,
        sender: message.sender.identifier,
        traceKey,
      },
      'Received HubMessage message event',
    )

    await enqueueThinkzapInboundJob(
      {
        source: 'hubmessage',
        type: messageEventType,
        body: message as unknown as Record<string, unknown>,
        traceKey,
      },
      // BullMQ rejeita ':' em jobId custom ("Custom Id cannot contain :").
      { jobId: `hubmessage-${message._id}` },
    )

    return this.ok({ data: 'Webhook recebido com sucesso' })
  }
}
