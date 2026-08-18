import { randomUUID } from 'node:crypto'
import { Request, Response } from 'express'

import { enqueueThinkzapInboundJob } from '@/queue/thinkzap-inbound.queue'
import { httpResponse } from '@/shared/helpers/http'
import { apiLogger } from '@/shared/infra/logger'
import { Controller } from '@/shared/presentation/controller'
import {
  findStatusStateItem,
  isDeliveryFailureState,
  isHubMessageStatusEnvelope,
  isHubMessageWebhookEnvelope,
  type HubMessageStatusEnvelope,
} from '../../domain/interfaces/hubmessage-events.interface'

/**
 * Webhook da HubMessage (WhatsApp Oficial): `MESSAGE_RECEIVED` **e**
 * `MESSAGE_DELIVERY`, na mesma URL.
 *
 * A HubMessage não manda header nem campo de tipo que separe os dois — quem separa é a
 * forma do corpo. O status é testado **primeiro**: hoje ele não passaria pelo guard de
 * mensagem recebida (não tem `sender`), então a ordem inversa funcionaria por acidente
 * e quebraria no dia em que a HubMessage passar a mandar `sender` no status.
 *
 * Responde 200 mesmo quando descarta o evento: um payload que nunca será
 * processado (envelope inválido, mensagem nossa) não deve ser reentregue
 * indefinidamente pela HubMessage.
 */
export class HubmessageWebhookHandlerController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const body: unknown = req.body

    if (isHubMessageStatusEnvelope(body)) {
      await this.enqueueStatusEvent(body)
      return this.ok({ data: 'Webhook recebido com sucesso' })
    }

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

  /**
   * Enfileira o desfecho de uma mensagem que **nós** enviamos.
   *
   * `jobId` em namespace próprio (`hubmessage-status-`): o inbound usa
   * `hubmessage-<_id>`, e aqui o `_id` é o da mensagem **enviada**. Se os dois espaços
   * de id se cruzarem, o BullMQ colapsa eventos de significados diferentes e um deles
   * desaparece sem deixar log.
   *
   * A chave é o `identifier` da transição de estado, não o da mensagem: reentrega do
   * mesmo evento colapsa (é o que impede aviso duplicado no chat do cliente), e duas
   * transições distintas da mesma mensagem seguem como jobs separados.
   */
  private async enqueueStatusEvent(
    envelope: HubMessageStatusEnvelope,
  ): Promise<void> {
    const { message } = envelope
    const stateItem = findStatusStateItem(envelope)
    const state = stateItem?.state
    const traceKey = randomUUID()

    apiLogger.info(
      {
        app: 'thinkzap',
        source: 'hubmessage-status',
        channelId: message.channel_id,
        providerMessageId: message._id,
        stateIdentifier: stateItem?.identifier,
        stateName: state?.name,
        deliveryFailed: isDeliveryFailureState(state),
        recipient: message.recipient?.identifier,
        /** Cru, sempre: é a única pista de por que a Meta recusou. */
        failedDescription: state?.failedDescription,
        traceKey,
      },
      'Received HubMessage delivery status event',
    )

    await enqueueThinkzapInboundJob(
      {
        source: 'hubmessage-status',
        type: stateItem?.type ?? 'MESSAGE_DELIVERY',
        body: message as unknown as Record<string, unknown>,
        traceKey,
      },
      { jobId: `hubmessage-status-${stateItem?.identifier ?? message._id}` },
    )
  }
}
