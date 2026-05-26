import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { SessionHandler } from '../../infra/session-registry'
import { InstalledApp } from '@/shared/domain/entities/installed-app'
import type { ThinkzapAccessResult } from '@/modules/thinkzap/application/check-thinkzap-access'

export class SessionController extends Controller {
  constructor(
    private readonly sessionHandler: SessionHandler,
    private readonly app: InstalledApp,
    private readonly thinkzapAccess?: ThinkzapAccessResult,
  ) {
    super()
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const handlers = this.sessionHandler.handlers
    const data: Record<string, unknown> = {}
    if (!handlers) {
      return this.notFound(new Error('Handlers not found'))
    }

    if (this.thinkzapAccess) {
      data.thinkzapAccess = this.thinkzapAccess
    }

    for (const handler of handlers) {
      if (
        this.thinkzapAccess &&
        !this.thinkzapAccess.canAccess &&
        this.sessionHandler.appCode === 'crmthink.thinkzap'
      ) {
        continue
      }

      const result = await handler.perform({
        appId: this.app.id,
        thinkzapAccess: this.thinkzapAccess,
      })

      if (
        result.key === 'subscription' &&
        this.thinkzapAccess &&
        !this.thinkzapAccess.canAccessFinance
      ) {
        data.subscription = null
        continue
      }

      data[result.key] = result.data
    }
    return this.ok({
      app: this.app,
      ...data,
    })
  }
}
