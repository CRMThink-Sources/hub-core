import { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { AplicationNotFoundError } from '@/modules/application/domain/errors/aplication-not-found.error'
import { CustomerNotFoundError } from '@/modules/application/domain/errors/customer-not-found.error'
import { InvalidBitrixSubscriptionError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-subscription.error'
import { InvalidBitrixSubscriptionItemError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-subscription-item.error'
import { InvalidBitrixPlanError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-plan.error'
import { InvalidBitrixProductError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-product.error'
import { mapAplicationContextToView } from '../mappers/aplication-context.mapper'

/**
 * O middleware de auth popula `req.domainId`/`req.appId` a partir do JWT; ambos
 * são opcionais no tipo do Express, então o Zod é o que garante presença antes de
 * chegar no caso de uso.
 */
const tokenSchema = z.object({
  domainId: z.string().min(1),
  appCode: z.string().min(1),
})

/**
 * Erros que significam "a leitura de billing no CRM interno falhou": o Bitrix não
 * respondeu, ou respondeu com shape que o domínio não aceita. Viram 502 — nunca
 * 200 com lista vazia, que faria a tela oferecer contratação a cliente pagante.
 */
const isBillingReadFailure = (error: unknown): boolean =>
  error instanceof BitrixError ||
  error instanceof InvalidBitrixSubscriptionError ||
  error instanceof InvalidBitrixSubscriptionItemError ||
  error instanceof InvalidBitrixPlanError ||
  error instanceof InvalidBitrixProductError

/**
 * `GET /api/application/me` — contexto de billing da instalação do token.
 *
 * Controller fino: valida a entrada vinda do JWT, delega ao caso de uso e traduz
 * erro de domínio em status. Nenhuma regra de montagem do payload vive aqui.
 */
export class GetAplicationContextController extends Controller {
  constructor(private readonly getAplicationContext: GetAplicationContext) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { domainId, appCode } = tokenSchema.parse({
      domainId: req.domainId,
      appCode: req.appId,
    })

    try {
      const context = await this.getAplicationContext.execute({
        domainId,
        appCode,
      })

      /**
       * Assinatura cancelada não sai no `/me`: os conectores dela não são mais do
       * cliente, e a tela de conexões não deve exibi-los. O filtro é desta rota, e
       * não do caso de uso — os fluxos de linha e de mensagem que usam
       * `GetAplicationContext` precisam ver o status `cancelled` para recusar.
       */
      return this.ok(
        mapAplicationContextToView({
          ...context,
          subscriptions: context.subscriptions.filter(
            subscription => subscription.status !== 'cancelled',
          ),
        }),
      )
    } catch (error) {
      /**
       * Token válido cujo cliente ou instalação não existe mais (app
       * desinstalado, `core_apps` limpo) é recurso ausente, não token inválido.
       */
      if (
        error instanceof CustomerNotFoundError ||
        error instanceof AplicationNotFoundError
      ) {
        return this.notFound(error)
      }

      /**
       * Tratado aqui e não na classe base: `Controller.handle` mapeia
       * `BitrixError` para 400, e mudar isso afetaria todos os módulos. O 502
       * local diz a verdade — a falha é de um upstream, não da requisição.
       */
      if (isBillingReadFailure(error)) {
        return {
          status: 502,
          result: {
            error: 'Falha ao ler o billing da instalação',
            message: error instanceof Error ? error.message : undefined,
          },
        }
      }

      throw error
    }
  }
}
