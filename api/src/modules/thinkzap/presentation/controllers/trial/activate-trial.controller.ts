import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import {
  ActivateConnectorTrial,
  TrialNotEligibleError,
} from '@/modules/thinkzap/application/activate-connector-trial'
import {
  TrialPlanMissingError,
  TrialPlanNotConfiguredError,
} from '@/modules/thinkzap/application/helpers/ensure-trial-plan'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'

/**
 * Só o provider. `strict()` porque período e status são regra de negócio derivada no
 * servidor — aceitar qualquer um dos dois no corpo deixaria o cliente escolher a
 * duração do próprio teste.
 */
const bodySchema = z
  .object({
    provider: z.enum([ConnectorProvider.ZAPI, ConnectorProvider.HUBMESSAGE]),
  })
  .strict()

const installSchema = z.object({
  domainId: z.string().min(1),
  appCode: z.string().min(1),
})

/** `POST /api/thinkzap/trial` — ativa o teste de 3 dias com o provider escolhido. */
export class ActivateTrialController extends Controller {
  constructor(private readonly activate: ActivateConnectorTrial) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const install = installSchema.safeParse({
      domainId: req.domainId,
      appCode: req.appId,
    })

    if (!install.success) {
      return this.badRequest(new Error('Instalação ausente no token'))
    }

    const body = bodySchema.safeParse(req.body)
    if (!body.success) {
      return this.badRequest(
        new Error(`Requisição inválida: ${body.error.message}`),
      )
    }

    try {
      const result = await this.activate.execute({
        ...install.data,
        provider: body.data.provider,
      })

      return this.ok({
        trial: {
          subscriptionId: result.subscriptionId,
          currentPeriodEnd: result.currentPeriodEnd,
          line: { id: result.item.id, name: result.item.name },
        },
      })
    } catch (error) {
      /**
       * Inelegível é `409`, não `400`: a requisição está bem formada e o estado do
       * recurso é que recusa. E a razão vai no corpo para a tela escolher a mensagem
       * entre "seu teste acabou" e "você já é cliente".
       */
      if (error instanceof TrialNotEligibleError) {
        return {
          status: 409,
          result: { error: error.message, reason: error.reason },
        }
      }

      /**
       * Configuração faltando é `503`, não `500`: não é bug do pedido nem falha
       * transitória — é o ambiente sem o plano de trial, e a mensagem nomeia o que
       * criar.
       */
      if (
        error instanceof TrialPlanNotConfiguredError ||
        error instanceof TrialPlanMissingError
      ) {
        return { status: 503, result: { error: error.message } }
      }

      throw error
    }
  }
}
