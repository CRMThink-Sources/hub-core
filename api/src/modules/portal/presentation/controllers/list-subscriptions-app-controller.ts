import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { listSubscriptionsForApp } from '../../application/list-subscriptions-for-app'
import { PortalAppNotFoundError } from '../../domain/errors/portal-domain.errors'

export class ListSubscriptionsAppController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { appId } = req.params

    if (!appId || typeof appId !== 'string') {
      return this.badRequest(new Error('Invalid app id'))
    }

    try {
      const output = await listSubscriptionsForApp(appId)
      return this.ok(output)
    } catch (error) {
      if (error instanceof PortalAppNotFoundError) {
        return this.notFound(error)
      }

      throw error
    }
  }
}
