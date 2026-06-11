import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { ImportSheetImportRepository } from '../../domain/repositories/importsheet-import.repository'
import { enqueueImportRun } from '../../queue/importsheet-run.queue'

export class RunImportController extends Controller {
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

    const app = await this.installedAppRepository.getByAppCodeAndDomainId(
      appId,
      domainId,
    )
    if (!app) return this.notFound(new Error('App not found'))

    // Confere posse antes de enfileirar.
    const found = await this.importRepository.findById(id, app.id)
    if (!found) return this.notFound(new Error('Import not found'))

    // Pausada: o worker faria `skipped` calado → barra aqui (UX não mente).
    if (!found.enabled) {
      return this.conflict(
        new Error('Importação pausada — ative antes de rodar manualmente'),
      )
    }

    await enqueueImportRun({ importId: id, trigger: 'manual' })

    return this.ok({ enqueued: true })
  }
}
