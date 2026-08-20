import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import {
  AlreadySubscribedError,
  CreateSubscriptionCheckout,
  PlanNotOfferableError,
} from '@/modules/thinkzap/application/create-subscription-checkout'
import {
  PlanForProviderAmbiguousError,
  PlanForProviderMissingError,
} from '@/modules/thinkzap/application/helpers/build-contract-line-items'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'

/**
 * `strict()` e não `object()`: preço, quantidade e período são derivados no
 * servidor, e um corpo que os traga é **recusado** em vez de ignorado.
 *
 * Ignorar seria funcionalmente equivalente hoje, e mentiroso amanhã: no dia em que
 * um campo homônimo entrar no schema, um corpo antigo passaria a ser aceito com
 * significado novo. A recusa é o que torna "o cliente não escolhe quanto paga"
 * verificável.
 */
const bodySchema = z.strictObject({
  planId: z.string().min(1),
})

const installationSchema = z.object({
  domainId: z.string().min(1),
  appCode: z.string().min(1),
})

/** `POST /api/thinkzap/subscription/checkout`. */
export class CreateCheckoutController extends Controller {
  constructor(private readonly checkout: CreateSubscriptionCheckout) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const installation = installationSchema.safeParse({
      domainId: req.domainId,
      appCode: req.appId,
    })

    if (!installation.success) {
      return this.badRequest(new Error('Instalação ausente no token'))
    }

    const body = bodySchema.safeParse(req.body ?? {})
    if (!body.success) {
      return this.badRequest(
        new Error(
          'Corpo inválido: informe apenas o id do plano — preço, quantidade e período são definidos no servidor',
        ),
      )
    }

    try {
      const session = await this.checkout.execute({
        ...installation.data,
        planId: body.data.planId,
      })

      return this.ok(session)
    } catch (error) {
      if (error instanceof PlanNotOfferableError) {
        logThinkzapError(
          apiLogger,
          'thinkzap.subscription.plan_not_offerable',
          { app: 'thinkzap', err: error },
          { level: 'warn' },
        )
        return this.badRequest(error)
      }
      /**
       * `409` e não `400`: os três são conflito com o estado da instalação ou com a
       * configuração do catálogo, e nenhum se resolve mandando outro corpo — que é o
       * que um `400` sugeriria.
       */
      if (
        error instanceof AlreadySubscribedError ||
        error instanceof PlanForProviderMissingError ||
        error instanceof PlanForProviderAmbiguousError
      ) {
        logThinkzapError(
          apiLogger,
          error instanceof AlreadySubscribedError
            ? 'thinkzap.subscription.already_subscribed'
            : error instanceof PlanForProviderMissingError
              ? 'thinkzap.subscription.plan_for_provider_missing'
              : 'thinkzap.subscription.plan_for_provider_ambiguous',
          { app: 'thinkzap', err: error },
          { level: 'warn' },
        )
        return this.conflict(error)
      }
      logThinkzapError(
        apiLogger,
        'thinkzap.gateway.checkout_create_failed',
        { app: 'thinkzap', err: error },
        { level: 'error' },
      )
      throw error
    }
  }
}
