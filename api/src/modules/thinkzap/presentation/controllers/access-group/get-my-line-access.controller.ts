import { Request, Response } from 'express'
import type { WidgetLineAccess } from '@/modules/thinkzap/application/access-group/widget-line-access'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'

/**
 * Linhas que os grupos de acesso liberam ao usuário do token, para o seletor de linha
 * do widget.
 *
 * Fica antes do `thinkzapAccessMiddleware`: quem envia pelo widget não administra o
 * ThinkZap nem tem `connectors:read`, e o middleware responderia 403.
 *
 * `restricted: false` = a instalação não tem grupos e todas as linhas servem. Com
 * `restricted: true`, `allowedLineIds` é o que o widget cruza com as linhas
 * elegíveis (pode vir vazio: o usuário fica sem linha).
 */
export class GetMyLineAccessController extends Controller {
  constructor(private readonly access: WidgetLineAccess) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { appId, domainId, bitrixUserId } = req
    if (!appId || !domainId || !bitrixUserId) {
      return this.unauthorized(new Error('Invalid or expired token'))
    }
    const result = await this.access.resolve({
      appCode: appId,
      domainId,
      bitrixUserId,
    })
    return this.ok(result)
  }
}
