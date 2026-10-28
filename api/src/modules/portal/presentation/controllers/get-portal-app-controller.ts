import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetPortalAppDetail } from '../../application/get-portal-app-detail'
import { PortalAppNotFoundError } from '../../domain/errors/portal-domain.errors'

export class GetPortalAppController extends Controller {
  constructor(private readonly getPortalAppDetail: GetPortalAppDetail) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { appId } = req.params as { appId: string }

    try {
      return this.ok(await this.getPortalAppDetail.execute(appId))
    } catch (error) {
      if (error instanceof PortalAppNotFoundError) return this.notFound(error)

      throw error
    }
  }
}
