import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetLineStatusForWidget } from '@/modules/thinkzap/application/get-line-status-for-widget'
import { LineBlockedError } from '@/modules/thinkzap/domain/errors/line-blocked.error'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import { mapLineBlockedError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'

/**
 * A instalação vem do JWT, o item vem do path. Como nas rotas de linha, a instalação
 * **não** vem da request: se viesse, o chamador escolheria o escopo.
 */
const schema = z.object({
  subscriptionItemId: z.string().min(1),
  domainId: z.string().min(1),
  appCode: z.string().min(1),
})

/**
 * `GET /api/thinkzap/messages/line-status/:subscriptionItemId` — se a linha está
 * conectada, para o widget avisar na seleção.
 *
 * **Só dois booleanos saem daqui.** A rota é aberta a qualquer usuário Bitrix com
 * JWT (bloco do widget), então o payload é montado campo por campo em vez de
 * espelhar o caso de uso: `instance` da Z-API carrega `token`.
 *
 * `mapLineError` não é reusado: ele traduz falha de leitura do provider para `502`, e
 * aqui essa falha é `200` com `available: false` — o widget precisa distinguir
 * "desconectada" de "não deu para saber".
 */
export class GetLineStatusForWidgetController extends Controller {
  constructor(private readonly getLineStatus: GetLineStatusForWidget) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = schema.parse({
      subscriptionItemId: req.params.subscriptionItemId,
      domainId: req.domainId,
      appCode: req.appId,
    })

    try {
      const status = await this.getLineStatus.execute(input)

      return this.ok({
        connected: status.connected,
        available: status.available,
      })
    } catch (error) {
      /** Item fora da árvore da instalação do token — indistinguível de inexistente. */
      if (error instanceof LineNotFoundError) {
        return this.notFound(error)
      }

      /** `402` com `code: 'line-blocked'`, igual às rotas de linha. */
      if (error instanceof LineBlockedError) {
        return mapLineBlockedError(error)
      }

      /**
       * Item de cobrança sem conector (`provider: 'NONE'`) — não é linha, não tem
       * status. Linha HubMessage **não** cai mais aqui: a leitura passou a ser
       * provider-aware quando o widget começou a compor template nela.
       */
      if (error instanceof LineProviderNotSupportedError) {
        return this.badRequest(error)
      }

      throw error
    }
  }
}
