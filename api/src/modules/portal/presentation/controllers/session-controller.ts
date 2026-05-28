import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetPortalSession } from '../../application/get-portal-session'
import { PortalUserNotFoundError } from '../../domain/errors/portal-auth.errors'

export class PortalSessionController extends Controller {
  constructor(private readonly getPortalSession: GetPortalSession) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const portalUserId = req.portalUserId

    if (!portalUserId) {
      return {
        status: 401,
        result: { error: 'Unauthorized' },
      }
    }

    try {
      const session = await this.getPortalSession.execute(portalUserId)
      return this.ok(session)
    } catch (error) {
      if (error instanceof PortalUserNotFoundError) {
        return {
          status: 401,
          result: { error: 'Unauthorized' },
        }
      }

      throw error
    }
  }
}
