import { Request } from 'express'
import { env } from '@/config/env'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { UpdateInstanceRepository } from '@/modules/thinkzap/domain/repositories/update-instance.repository'
import { assertConnectorLineEnabled } from '@/modules/thinkzap/application/helpers/resolve-line-by-subscription-item'
import { mapLineError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { parseLineRequest } from './line-request'

/**
 * `DELETE /api/thinkzap/lines/:itemId/channel` — desvincula o canal aberto.
 *
 * O canal a desativar vem do que está **persistido no item**, não do corpo: quem
 * chama não escolhe qual canal desligar.
 */
export class UnlinkLineChannelController extends Controller {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly items: SubscriptionItemRepository,
    private readonly instances: GetInstanceRepository &
      UpdateInstanceRepository,
    private readonly bitrixClient: BitrixClient,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)

    try {
      const context = await this.getAplicationContext.execute({
        domainId: input.domainId,
        appCode: input.appCode,
      })

      /**
       * Desvincular também é escrita, e também recusa. Parece contraintuitivo —
       * desligar o canal de uma linha morta é inofensivo — mas o vínculo é
       * configuração do cliente, e deixar apagar o que ele não consegue refazer
       * transformaria o bloqueio em perda de dado.
       */
      const item = assertConnectorLineEnabled(
        context,
        input.subscriptionItemId,
        new Date(),
      )
      const { vinculatedChannel } = item

      // Já sem canal: nada a desativar no Bitrix, e o resultado desejado já vale.
      if (!vinculatedChannel) {
        return this.ok({ vinculatedChannel: null })
      }

      await this.bitrixClient.activateConnector(
        Number(vinculatedChannel),
        env.bitrix.connector.code,
        0,
      )

      await this.items.updateSubscriptionItem(item.id, {
        vinculatedChannel: null,
      })

      /**
       * A âncora de `Instance` **não** é tocada: o roteamento resolve a linha pelo
       * item, então limpar o vínculo lá já basta para a mensagem parar de chegar.
       *
       * A coluna `vinculated_channel` da tabela fica desatualizada por design —
       * deixou de ser lida quando `PrismaBitrixWebhookContextRepository` passou a
       * achar a linha pelo item.
       */
      return this.ok({ vinculatedChannel: null })
    } catch (error) {
      return mapLineError(error, 'Falha ao desvincular o canal aberto')
    }
  }
}
