import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetLineSubscriptionState } from '@/modules/thinkzap/application/get-line-subscription-state'

/** A instalação vem do JWT, nunca do corpo — mesma postura das rotas de linha. */
const schema = z.object({
  domainId: z.string().min(1),
  appCode: z.string().min(1),
})

/**
 * `GET /api/thinkzap/subscription` — o que a tela precisa para decidir entre
 * oferecer contratação, mostrar o contrato vigente, ou explicar o bloqueio.
 */
export class GetSubscriptionStateController extends Controller {
  constructor(private readonly getState: GetLineSubscriptionState) {
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

    return this.ok({ subscription: await this.getState.execute(parsed.data) })
  }
}
