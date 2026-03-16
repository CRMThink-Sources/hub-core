import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { SessionHandler } from '../../infra/session-registry'
import { InstalledApp } from '@/shared/domain/entities/installed-app'

export class SessionController extends Controller {
  constructor(
    private readonly sessionHandler: SessionHandler,
    private readonly app: InstalledApp,
  ) {
    super()
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const handlers = this.sessionHandler.handlers
    const data: Record<string, unknown> = {}
    if (!handlers) {
      return this.notFound(new Error('Handlers not found'))
    }
    for (const handler of handlers) {
      const result = await handler.perform({ appId: this.app.id })
      data[result.key] = result.data
    }
    return this.ok({
      app: this.app,
      ...data,
    })
  }
}
