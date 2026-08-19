import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { AplicationNotFoundError } from '@/modules/application/domain/errors/aplication-not-found.error'
import { CustomerNotFoundError } from '@/modules/application/domain/errors/customer-not-found.error'
import { InvalidBitrixSubscriptionError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-subscription.error'
import { InvalidBitrixSubscriptionItemError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-subscription-item.error'
import { InvalidBitrixPlanError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-plan.error'
import { InvalidBitrixProductError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-product.error'
import { listAppSubscriptions } from '../../application/list-app-subscriptions'
import { AdminAppNotFoundError } from '../../application/helpers/resolve-admin-line'

/**
 * "A leitura de billing no CRM interno falhou" — vira `502`, nunca `200` com lista
 * vazia, que faria a aba afirmar que o cliente não tem contrato. Mesma lista de erros
 * que `GET /api/application/me` usa; o `Controller.handle` mapearia `BitrixError` para
 * `400`, e `400` mentiria sobre de quem é a falha.
 */
const isBillingReadFailure = (error: unknown): boolean =>
  error instanceof BitrixError ||
  error instanceof InvalidBitrixSubscriptionError ||
  error instanceof InvalidBitrixSubscriptionItemError ||
  error instanceof InvalidBitrixPlanError ||
  error instanceof InvalidBitrixProductError

export class ListAppSubscriptionsController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { appId } = req.params as { appId: string }

    try {
      return this.ok(await listAppSubscriptions(appId))
    } catch (error) {
      /** Instalação que não existe mais em `core_apps`, ou cliente sem linha em `core_domains`. */
      if (
        error instanceof AdminAppNotFoundError ||
        error instanceof AplicationNotFoundError ||
        error instanceof CustomerNotFoundError
      ) {
        return this.notFound(error)
      }

      if (isBillingReadFailure(error)) {
        return this.badGateway(
          new Error('Falha ao ler o billing da instalação'),
        )
      }

      throw error
    }
  }
}
