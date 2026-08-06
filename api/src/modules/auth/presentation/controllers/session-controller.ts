import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import {
  SessionAuthContext,
  SessionHandler,
} from '../../infra/session-registry'

/**
 * Agregado de dados por app. **Legado em redução.**
 *
 * O que saiu daqui:
 * - `app` — a instalação vem de `GET /api/application/me`
 * - `thinkzapAccess` — as permissões vêm de `GET /api/thinkzap/access/me`
 *
 * O que continua: as chaves que cada app registra via `SessionRegistry`
 * (`connectors`, `subscription`, `googleConnection`, `imports`,
 * `biconnectors`). Quebrar essas em endpoints próprios é outra change.
 *
 * Este controller não conhece nenhuma app: repassa o contexto de autenticação e
 * emite o que os handlers devolvem. Ver spec `aplication-context-provider`.
 */
export class SessionController extends Controller {
  constructor(
    private readonly sessionHandler: SessionHandler,
    private readonly authContext: SessionAuthContext,
  ) {
    super()
  }

  async perform(_req: Request, _res: Response): Promise<httpResponse> {
    const handlers = this.sessionHandler.handlers
    if (!handlers) {
      return this.notFound(new Error('Handlers not found'))
    }

    const data: Record<string, unknown> = {}

    for (const handler of handlers) {
      const result = await handler.perform(this.authContext)
      data[result.key] = result.data
    }

    return this.ok(data)
  }
}
