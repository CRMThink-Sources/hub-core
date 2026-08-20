import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { UpdateInstanceRepository } from '@/modules/thinkzap/domain/repositories/update-instance.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { resolveLineBySubscriptionItem } from '@/modules/thinkzap/application/helpers/resolve-line-by-subscription-item'
import { mapLineError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { parseLineRequest } from './line-request'

/**
 * `POST /api/thinkzap/lines/:itemId/disconnect` — desconecta o número da linha.
 *
 * Desconectar é operação de conexão: derruba a sessão do WhatsApp, mas não mexe na
 * assinatura. Cancelar a linha é operação de assinatura e não existe nesta
 * superfície.
 */
export class DisconnectLineController extends Controller {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly instanceRepository: GetInstanceRepository &
      UpdateInstanceRepository,
    private readonly zApiClient: ZApiClient,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)

    try {
      const line = await resolveLineBySubscriptionItem(
        input,
        this.getAplicationContext,
      )

      await this.zApiClient.disconnectInstance(
        line.zApiInstanceId,
        line.zApiInstanceToken,
      )

      /**
       * Só depois de a Z-API confirmar. Marcar antes deixaria o banco dizendo
       * desconectado com a sessão ainda de pé.
       *
       * A row é buscada **aqui**, e não na resolução da linha: é o único consumidor
       * desta superfície que precisa dela. Linha sem registro persistido não tem o
       * que marcar — a desconexão no provider já aconteceu, e isso é o que importa.
       */
      const instance = await this.instanceRepository.getInstanceByInstanceId(
        line.zApiInstanceId,
      )
      if (instance) {
        await this.instanceRepository.markAsDisconnected(instance.id)
      }

      return this.ok({ disconnected: true })
    } catch (error) {
      return mapLineError(error, 'Falha ao desconectar a linha')
    }
  }
}
