import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { assertConnectorLineEnabled } from '@/modules/thinkzap/application/helpers/resolve-line-by-subscription-item'
import { UpdateLineSettings } from '@/modules/thinkzap/application/update-line-settings'
import { mapLineError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { parseLineRequest } from './line-request'

/**
 * Só os quatro campos de `ConnectorSettings` e o nome. `strict()` de propósito: um
 * campo desconhecido no corpo é erro, não algo a ignorar em silêncio — inclusive
 * `connectorId`, que era o identificador antigo.
 */
const bodySchema = z
  .object({
    name: z.string().min(1).optional(),
    settings: z
      .object({
        prefixOperatorNameEnabled: z.boolean().optional(),
        widgetOpenChannelEnabled: z.boolean().optional(),
        messageUpdateEventEnabled: z.boolean().optional(),
        messageDeleteEventEnabled: z.boolean().optional(),
        // Forma aqui; regra (provider, inteiro > 0 quando ligado) no caso de uso.
        dailyLimitEnabled: z.boolean().optional(),
        dailyLimit: z.number().int().positive().nullable().optional(),
        // Só Z-API; a recusa em linha oficial é do caso de uso.
        deviceMessageMirrorEnabled: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

/**
 * `PATCH /api/thinkzap/lines/:itemId/settings` — grava nome e/ou toggles.
 *
 * `GetInstanceRepository` saiu: os toggles vivem no item da SPA, então uma linha
 * sem registro em `Instance` grava normalmente. O `409` de "linha ainda não
 * provisionada" deixou de existir — ele recusava a gravação por causa de uma
 * tabela que nem participa mais do dado.
 */
export class UpdateLineSettingsController extends Controller {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly updateLineSettings: UpdateLineSettings,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)
    const body = bodySchema.safeParse(req.body)

    if (!body.success) {
      return this.badRequest(
        new Error('Invalid request: ' + body.error.message),
      )
    }

    const hasSettings =
      body.data.settings !== undefined &&
      Object.keys(body.data.settings).length > 0

    if (body.data.name === undefined && !hasSettings) {
      return this.badRequest(
        new Error('At least one of name or settings must be provided'),
      )
    }

    try {
      const context = await this.getAplicationContext.execute({
        domainId: input.domainId,
        appCode: input.appCode,
      })

      // O contexto já foi lido acima (precisa do `aplication.id` para os binds e
      // do host em `customer.name` para o prefixo do nome), então a parte pura
      // reaproveita em vez de pagar outra leitura do Bitrix.
      //
      // Gravar ajuste é escrita: linha de trial vencido recusa aqui, antes de o
      // caso de uso tocar a SPA ou renomear no provider.
      const item = assertConnectorLineEnabled(
        context,
        input.subscriptionItemId,
        new Date(),
      )

      await this.updateLineSettings.execute({
        item,
        domainName: context.customer.name,
        appId: context.aplication.id,
        name: body.data.name,
        settings: body.data.settings,
      })

      return this.ok({ saved: true })
    } catch (error) {
      return mapLineError(error, 'Falha ao salvar os ajustes da linha')
    }
  }
}
