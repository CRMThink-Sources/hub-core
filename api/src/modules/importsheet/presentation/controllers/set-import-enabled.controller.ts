import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { ImportSheetImportRepository } from '../../domain/repositories/importsheet-import.repository'
import { apiLogger } from '@/shared/infra/logger'

export class SetImportEnabledController extends Controller {
  constructor(
    private readonly installedAppRepository: GetInstalledAppRepository,
    private readonly importRepository: ImportSheetImportRepository,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const appId = req.appId as string
    const domainId = req.domainId as string

    const id = Number(req.params.id)
    if (!Number.isInteger(id)) return this.badRequest(new Error('Invalid id'))

    const enabled = (req.body as { enabled?: unknown })?.enabled
    if (typeof enabled !== 'boolean') {
      return this.badRequest(new Error('enabled must be a boolean'))
    }

    const app = await this.installedAppRepository.getByAppCodeAndDomainId(
      appId,
      domainId,
    )
    if (!app) return this.notFound(new Error('App not found'))

    const updated = await this.importRepository.setEnabled(id, app.id, enabled)
    if (!updated) return this.notFound(new Error('Import not found'))

    apiLogger.info(
      { app: 'importsheet', appId: app.id, importId: id, enabled },
      enabled ? 'Importação ativada' : 'Importação pausada',
    )

    return this.ok({ id: updated.id, enabled: updated.enabled })
  }
}
