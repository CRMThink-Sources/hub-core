import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetConnectorTrialState } from '@/modules/thinkzap/application/get-connector-trial-state'

/** A instalação vem do JWT, nunca do corpo — mesma postura das rotas de linha. */
const schema = z.object({
  domainId: z.string().min(1),
  appCode: z.string().min(1),
})

/**
 * `GET /api/thinkzap/trial` — o que a tela precisa para decidir entre oferecer o
 * teste, mostrar o prazo, ou explicar por que não dá.
 */
export class GetTrialStateController extends Controller {
  constructor(private readonly getState: GetConnectorTrialState) {
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

    return this.ok({ trial: await this.getState.execute(parsed.data) })
  }
}
