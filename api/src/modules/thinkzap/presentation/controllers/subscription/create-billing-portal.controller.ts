import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import {
  BillingPortalNotAvailableError,
  CreateBillingPortalSession,
} from '@/modules/thinkzap/application/create-billing-portal-session'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'

/** A instalação vem do JWT. O corpo não carrega nada. */
const schema = z.object({
  domainId: z.string().min(1),
  appCode: z.string().min(1),
})

/** `POST /api/thinkzap/subscription/billing-portal`. */
export class CreateBillingPortalController extends Controller {
  constructor(private readonly portal: CreateBillingPortalSession) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const parsed = schema.safeParse({
      domainId: req.domainId,
      appCode: req.appId,
    })

    if (!parsed.success) {
      return this.badRequest(new Error('Instalação ausente no token'))
    }

    try {
      return this.ok(await this.portal.execute(parsed.data))
    } catch (error) {
      /**
       * `400` e não `404`: a assinatura existe, o portal é que não se aplica a
       * ela. `404` faria a tela dizer "não encontrado" para um boleto ativo.
       */
      if (error instanceof BillingPortalNotAvailableError) {
        logThinkzapError(
          apiLogger,
          'thinkzap.subscription.billing_portal_unavailable',
          { app: 'thinkzap', err: error },
          { level: 'warn' },
        )
        return this.badRequest(error)
      }
      logThinkzapError(
        apiLogger,
        'thinkzap.gateway.portal_create_failed',
        { app: 'thinkzap', err: error },
        { level: 'error' },
      )
      throw error
    }
  }
}
