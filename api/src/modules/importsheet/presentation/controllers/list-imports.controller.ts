import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { ListImportsService } from '../../application/list-imports.service'

/**
 * Listagem leve das importações — mesma forma que vem na sessão, mas via GET
 * dedicado pra polling em tempo real (último run / status sem recarregar sessão).
 */
export class ListImportsController extends Controller {
  constructor(
    private readonly installedAppRepository: GetInstalledAppRepository,
    private readonly service: ListImportsService,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const appId = req.appId as string
    const domainId = req.domainId as string

    const app = await this.installedAppRepository.getByAppCodeAndDomainId(
      appId,
      domainId,
    )
    if (!app) return this.notFound(new Error('App not found'))

    const imports = await this.service.execute(app.id)

    return this.ok({ imports })
  }
}
