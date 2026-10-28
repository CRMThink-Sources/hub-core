import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import type {
  ActivateSubscription,
  DeactivateSubscription,
} from '../../application/subscription-status-actions'
import type { subscribeSubscriptionLines } from '../../application/subscribe-subscription-lines'
import { mapBackofficeActionError } from '../map-backoffice-action-error'

type Params = { appId: string; subscriptionId: string }

/**
 * Base das três ações na assinatura: mesma tradução de erro, mesma leitura de params.
 * Falha do CRM interno é `502` — o `handle` genérico mapearia `BitrixError` para `400`,
 * e `400` mentiria sobre de quem é a falha.
 */
abstract class SubscriptionActionController extends Controller {
  protected abstract run(params: Params, req: Request): Promise<unknown>

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const params = req.params as Params

    try {
      return this.ok(await this.run(params, req))
    } catch (error) {
      const mapped = mapBackofficeActionError(error)
      if (mapped) return mapped

      if (error instanceof BitrixError) {
        return this.badGateway(
          new Error('Falha ao acessar a SPA de assinaturas'),
        )
      }

      throw error
    }
  }
}

export class ActivateSubscriptionController extends SubscriptionActionController {
  constructor(
    private readonly activate: Pick<ActivateSubscription, 'execute'>,
  ) {
    super()
  }

  protected run(params: Params, req: Request) {
    const body = (req.body ?? {}) as { currentPeriodEnd?: unknown }

    return this.activate.execute({
      ...params,
      ...(typeof body.currentPeriodEnd === 'string' && {
        currentPeriodEnd: body.currentPeriodEnd,
      }),
    })
  }
}

export class DeactivateSubscriptionController extends SubscriptionActionController {
  constructor(
    private readonly deactivate: Pick<DeactivateSubscription, 'execute'>,
  ) {
    super()
  }

  protected run(params: Params) {
    return this.deactivate.execute(params)
  }
}

export class SubscribeSubscriptionLinesController extends SubscriptionActionController {
  constructor(
    private readonly subscribeLines: (
      input: Params,
    ) => ReturnType<typeof subscribeSubscriptionLines>,
  ) {
    super()
  }

  protected run(params: Params) {
    return this.subscribeLines(params)
  }
}
