import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { ListPortalDomains } from '../../application/list-portal-domains'

export class ListPortalDomainsController extends Controller {
  constructor(private readonly listPortalDomains: ListPortalDomains) {
    super()
  }

  async perform(_req: Request, _res: Response): Promise<httpResponse> {
    const result = await this.listPortalDomains.execute()
    return this.ok(result)
  }
}
