import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { HandleGatewayWebhookEvent } from '@/modules/thinkzap/application/handle-gateway-webhook-event'
import {
  GatewaySignatureError,
  PaymentGateway,
} from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'

/** Cabeçalho de assinatura do evento. */
export const STRIPE_SIGNATURE_HEADER = 'stripe-signature'

/**
 * `POST /api/webhooks/stripe`.
 *
 * Registrada **antes** do `express.json()`, com `express.raw`: a validação da
 * assinatura é um HMAC sobre os bytes exatos que chegaram, e depois do parser o
 * corpo foi reserializado — a assinatura passa a falhar **sempre**. Por isso o
 * controller exige `Buffer` e recusa qualquer outra coisa, em vez de tentar
 * reconstruir o corpo: um corpo remontado que passasse na validação seria pior,
 * porque validaria bytes que ninguém assinou.
 */
export class StripeWebhookController extends Controller {
  constructor(
    private readonly gateway: PaymentGateway,
    private readonly handleEvent: HandleGatewayWebhookEvent,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    if (!Buffer.isBuffer(req.body)) {
      /**
       * Sintoma de registro na ordem errada — a rota caiu depois do parser de JSON.
       * Nomeado no log porque a alternativa (assinatura inválida em 100% dos
       * eventos) manda procurar no lugar errado: parece problema de segredo.
       */
      logThinkzapError(
        apiLogger,
        'thinkzap.gateway.webhook_payload_invalid',
        { app: 'thinkzap' },
        {
          level: 'error',
          msg: 'Webhook do gateway recebeu corpo já parseado — a rota tem que ser registrada antes do express.json()',
        },
      )
      return this.badRequest(
        new Error('Corpo do webhook precisa chegar cru (Buffer)'),
      )
    }

    const signature = req.header(STRIPE_SIGNATURE_HEADER)

    let event
    try {
      event = await this.gateway.verifyWebhookEvent(req.body, signature)
    } catch (error) {
      if (error instanceof GatewaySignatureError) {
        logThinkzapError(
          apiLogger,
          'thinkzap.gateway.webhook_signature_invalid',
          { app: 'thinkzap', reason: error.message },
          {
            level: 'warn',
            msg: 'Evento do gateway recusado: assinatura inválida — nada foi processado',
          },
        )
        return this.unauthorized(error)
      }
      throw error
    }

    await this.handleEvent.execute(event)

    /**
     * `200` também para evento ignorado: o gateway trata resposta de erro como
     * "tente de novo" e reentrega em backoff. Um tipo de evento que não nos diz
     * nada não pode virar fila de retry.
     */
    return this.ok({ received: true })
  }
}
