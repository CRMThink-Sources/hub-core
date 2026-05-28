import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetPortalDomainDetail } from '../../application/get-portal-domain-detail'
import { PortalDomainNotFoundError } from '../../domain/errors/portal-domain.errors'

export class GetPortalDomainController extends Controller {
  constructor(private readonly getPortalDomainDetail: GetPortalDomainDetail) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const id = req.params.id

    if (!id || typeof id !== 'string') {
      return this.badRequest(new Error('Invalid domain id'))
    }

    try {
      const domain = await this.getPortalDomainDetail.execute(id)
      return this.ok(domain)
    } catch (error) {
      if (error instanceof PortalDomainNotFoundError) {
        return this.notFound(error)
      }

      throw error
    }
  }
}
