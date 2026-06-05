import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { ImportSheetImportRepository } from '../../domain/repositories/importsheet-import.repository'

export class GetImportController extends Controller {
  constructor(
    private readonly installedAppRepository: GetInstalledAppRepository,
    private readonly repository: ImportSheetImportRepository,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const appId = req.appId as string
    const domainId = req.domainId as string

    const id = Number(req.params.id)
    if (!Number.isInteger(id)) return this.badRequest(new Error('Invalid id'))

    const app = await this.installedAppRepository.getByAppCodeAndDomainId(
      appId,
      domainId,
    )
    if (!app) return this.notFound(new Error('App not found'))

    const found = await this.repository.findById(id, app.id)
    if (!found) return this.notFound(new Error('Import not found'))

    return this.ok({
      import: {
        id: found.id,
        title: found.title,
        config: found.config,
        scheduleMode: found.scheduleMode,
        everyHours: found.everyHours,
        weekdays: found.weekdays,
      },
    })
  }
}
