import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import {
  ActivateConnectorTrial,
  TrialContactWriteFailedError,
  TrialNotEligibleError,
} from '@/modules/thinkzap/application/activate-connector-trial'
import {
  TrialPlanMissingError,
  TrialPlanNotConfiguredError,
} from '@/modules/thinkzap/application/helpers/ensure-trial-plan'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import {
  InvalidTrialContactError,
  parseTrialContact,
} from '@/modules/thinkzap/domain/value-objects/trial-contact'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'

/**
 * Provider e contato, e nada mais. `strict()` porque período e status são regra de
 * negócio derivada no servidor — aceitar qualquer um dos dois no corpo deixaria o
 * cliente escolher a duração do próprio teste.
 *
 * Os campos de contato entram como `string` crua: quem valida forma e normaliza o
 * telefone é `parseTrialContact`, e duplicar a regra aqui daria duas fontes que
 * divergem.
 */
const bodySchema = z
  .object({
    provider: z.enum([ConnectorProvider.ZAPI, ConnectorProvider.HUBMESSAGE]),
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    company: z.string(),
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

    /**
     * Contato validado **antes** do caso de uso, e não dentro dele: entrada malformada
     * é `400` e não deve consumir leitura de contexto nem chamada ao CRM. O erro
     * nomeia o campo para a tela apontar o que corrigir.
     */
    let contact
    try {
      contact = parseTrialContact(body.data)
    } catch (error) {
      if (error instanceof InvalidTrialContactError) {
        return {
          status: 400,
          result: { error: error.message, field: error.field },
        }
      }
      throw error
    }

    try {
      const result = await this.activate.execute({
        ...install.data,
        provider: body.data.provider,
        contact,
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
        logThinkzapError(
          apiLogger,
          'thinkzap.subscription.trial_not_eligible',
          { app: 'thinkzap', reason: error.reason, err: error },
          { level: 'warn' },
        )
        return {
          status: 409,
          result: { error: error.message, reason: error.reason },
        }
      }

      /**
       * Contato não gravado é `502`: a requisição está correta e o CRM interno é que
       * não respondeu. Retentável, e nada foi provisionado — a instalação continua
       * elegível. O log já saiu no caso de uso, com o code do runbook.
       */
      if (error instanceof TrialContactWriteFailedError) {
        return this.badGateway(error)
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
        logThinkzapError(
          apiLogger,
          'thinkzap.subscription.trial_plan_missing',
          { app: 'thinkzap', err: error },
          { level: 'error' },
        )
        return { status: 503, result: { error: error.message } }
      }

      throw error
    }
  }
}
