import { randomUUID } from 'node:crypto'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { enqueueThinkzapInboundJob } from '@/queue/thinkzap-inbound.queue'
import { apiLogger } from '@/shared/infra/logger'

/**
 * `POST /api/webhooks/bitrix-bot` — eventos `ONIMBOTV2*`. Registro separado do conector
 * no portal, e este endereço é o gravado em `imbot.v2.Bot.register`: mudá-lo exige
 * `Bot.update`, não só deploy.
 *
 * Só enfileira: o Bitrix trata resposta lenta como falha de entrega e reenvia o evento,
 * o que duplicaria a fala do bot.
 */
export class BitrixBotWebhookHandlerController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const body = (req.body ?? {}) as Record<string, unknown>
    const event = typeof body.event === 'string' ? body.event.toUpperCase() : ''

    const traceKey = randomUUID()

    apiLogger.info(
      {
        app: 'thinkzap',
        source: 'bitrix-bot',
        event,
        traceKey,
      },
      'Bitrix bot event received — enqueueing',
    )

    // Enfileira todo evento, inclusive o que não tratamos: quem decide ignorar é o
    // `parseBotEvent`, que registra o motivo no log do job. Filtrar aqui esconderia
    // evento novo do portal atrás de um 200 silencioso.
    await enqueueThinkzapInboundJob({
      source: 'bitrix-bot',
      type: event || 'UNKNOWN',
      body,
      traceKey,
    })

    return this.ok({ message: 'Webhook received' })
  }
}
