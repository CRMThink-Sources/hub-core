import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import type { GetSendDetail } from '@/modules/thinkzap/application/get-send-detail'
import { SendNotFoundError } from '@/modules/thinkzap/domain/errors/send-not-found.error'

/** Id maior que isto não existe: cai no mesmo 404, sem consultar o banco. */
const MAX_ID_LENGTH = 191

/**
 * `GET /api/thinkzap/messages/sends/:id` — o detalhe de um envio da aba Envios.
 *
 * Toda negação (outra instalação, outro remetente, inexistente, fora dos 90 dias)
 * responde o mesmo 404 com o mesmo corpo: qualquer diferença revelaria que o envio
 * existe. A identidade vem só do token. Nada é logado: o detalhe traz texto e
 * telefone.
 */
export class GetSendDetailController extends Controller {
  constructor(private readonly getSendDetail: Pick<GetSendDetail, 'execute'>) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const { domainId, appId, bitrixUserId } = req
    const isAdmin = req.thinkzapAccess?.canManageAccess === true
    if (!domainId || !appId || (!bitrixUserId && !isAdmin)) {
      return this.unauthorized(new Error('Identidade do usuário ausente.'))
    }

    const id = String(req.params.id ?? '')
    if (!id || id.length > MAX_ID_LENGTH) {
      return this.notFound(new SendNotFoundError())
    }

    try {
      const detail = await this.getSendDetail.execute({
        id,
        domainId,
        appCode: appId,
        bitrixUserId: bitrixUserId ?? '',
        isAdmin,
      })
      return this.ok(detail)
    } catch (error) {
      if (error instanceof SendNotFoundError) return this.notFound(error)
      throw error
    }
  }
}
