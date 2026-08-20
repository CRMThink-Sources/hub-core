import { Request } from 'express'
import { z } from 'zod'
import { env } from '@/config/env'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { CreateInstanceRepository } from '@/modules/thinkzap/domain/repositories/create-instance.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { UpdateInstanceRepository } from '@/modules/thinkzap/domain/repositories/update-instance.repository'
import { ensureLineInstance } from '@/modules/thinkzap/application/helpers/ensure-line-instance'
import { assertConnectorLineEnabled } from '@/modules/thinkzap/application/helpers/resolve-line-by-subscription-item'
import { ChannelAlreadyLinkedError } from '@/modules/thinkzap/domain/errors/channel-already-linked.error'
import { AplicationContext } from '@/modules/application/application/get-aplication-context'
import { mapLineError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { parseLineRequest } from './line-request'

/** `strict()`: `connectorId` no corpo é erro, não campo ignorado. */
const bodySchema = z.object({ lineId: z.coerce.number() }).strict()

/**
 * `POST /api/thinkzap/lines/:itemId/channel` — vincula a linha a um canal aberto
 * do Bitrix.
 *
 * O vínculo é o que faz a mensagem rotear para o canal: sem ele a linha recebe e
 * envia, mas nada aparece no CRM do cliente.
 *
 * Persiste no item da SPA, não em `Instance`. Era o `409` de "linha ainda não
 * provisionada" que deixava a linha sem caminho nenhum para ser vinculada — e não
 * havia outro lugar no produto para configurar isso.
 */
export class LinkLineChannelController extends Controller {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly items: SubscriptionItemRepository,
    private readonly instances: GetInstanceRepository &
      CreateInstanceRepository &
      UpdateInstanceRepository,
    private readonly bitrixClient: BitrixClient,
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

    try {
      const context = await this.getAplicationContext.execute({
        domainId: input.domainId,
        appCode: input.appCode,
      })

      // Valida que o item é desta instalação, tem conector e está habilitado antes
      // de tocar o Bitrix: linha bloqueada não ativa canal aberto nenhum.
      const item = assertConnectorLineEnabled(
        context,
        input.subscriptionItemId,
        new Date(),
      )

      const vinculatedChannel = String(body.data.lineId)

      /**
       * Um canal aberto atende **uma** linha. Conferido antes de tocar o Bitrix: se o
       * canal já é de outra linha, não há por que ativar conector nenhum.
       *
       * Sem esta guarda o estado nascia sem aviso, e o sintoma aparecia longe daqui —
       * mensagem do operador saindo por um número imprevisível, aceita pelo provider,
       * com o job terminando em sucesso. Ver `AmbiguousChannelBindingError`.
       */
      assertChannelFree(context, vinculatedChannel, item.id)

      /**
       * Ativar no Bitrix **antes** de persistir: se a ativação falhar, o vínculo
       * não é gravado e a tela não mostra um canal que não recebe nada.
       */
      await this.bitrixClient.activateConnector(
        body.data.lineId,
        env.bitrix.connector.code,
      )

      await this.items.updateSubscriptionItem(item.id, {
        vinculatedChannel,
      })

      /**
       * Garante a âncora de `Instance`, criando quando falta. **Não é espelho do
       * vínculo:** o roteamento resolve a linha pelo item, não por
       * `where: { vinculatedChannel }` na tabela.
       *
       * A row existe só porque mensagem e conversa têm chave estrangeira para
       * `Instance.id` — sem ela a linha grava o vínculo e falha ao persistir a
       * primeira mensagem.
       *
       * Falha aqui **não** desfaz o vínculo no item: o dado do cliente está gravado
       * onde é a fonte. O erro sobe para o usuário saber que a linha ainda não
       * consegue registrar mensagem.
       */
      await ensureLineInstance(
        { ...item, vinculatedChannel },
        input.domainId,
        this.instances,
      )

      return this.ok({ vinculatedChannel })
    } catch (error) {
      return mapLineError(error, 'Falha ao vincular o canal aberto')
    }
  }
}

/**
 * Recusa o vínculo quando o canal já é de outra linha **ativa** da instalação.
 *
 * Item cancelado não ocupa canal: linha cancelada não responde por nada, e travar o
 * vínculo por causa dela deixaria o canal inutilizável sem nada na tela explicando o
 * porquê.
 *
 * Revincular a linha ao canal que ela **já** tem passa: é idempotente, e o próprio item
 * fica fora da comparação.
 */
function assertChannelFree(
  context: AplicationContext,
  vinculatedChannel: string,
  subscriptionItemId: string,
): void {
  const occupant = context.subscriptions
    .flatMap(subscription => subscription.items)
    .find(
      candidate =>
        candidate.id !== subscriptionItemId &&
        candidate.status !== 'cancelled' &&
        candidate.vinculatedChannel === vinculatedChannel,
    )

  if (!occupant) return

  throw new ChannelAlreadyLinkedError(
    vinculatedChannel,
    occupant.id,
    occupant.name,
  )
}
