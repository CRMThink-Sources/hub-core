import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import {
  LinkAplicationMirror,
  LinkMirrorRefusedError,
} from '../../application/link-aplication-mirror'
import { PortalAppNotFoundError } from '../../domain/errors/portal-domain.errors'

export class LinkAplicationMirrorController extends Controller {
  constructor(private readonly linkAplicationMirror: LinkAplicationMirror) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { appId } = req.params as { appId: string }

    try {
      return this.ok(await this.linkAplicationMirror.execute(appId))
    } catch (error) {
      if (error instanceof PortalAppNotFoundError) return this.notFound(error)

      // O motivo vai no corpo: a tela traduz cada um, e `ambiguous` mostra os ids.
      if (error instanceof LinkMirrorRefusedError) {
        return {
          status: 409,
          result: {
            error: error.message,
            reason: error.reason,
            ids: error.ids,
          },
        }
      }

      // A busca no CRM falhou: não é a requisição que está errada.
      if (error instanceof BitrixError) {
        return this.badGateway(new Error('Falha ao buscar o item na SPA 1060'))
      }

      throw error
    }
  }
}
