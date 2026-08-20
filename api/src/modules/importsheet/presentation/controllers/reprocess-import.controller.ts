import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { ImportSheetImportRepository } from '../../domain/repositories/importsheet-import.repository'
import { RunImportService } from '../../application/run-import.service'
import { isImportRunInFlight } from '../../queue/importsheet-run.queue'
import { logImportsheetError } from '../../errors/catalog'
import { apiLogger } from '@/shared/infra/logger'

const bodySchema = z.object({
  rows: z.array(z.number().int().positive()).min(1).max(50),
})

export class ReprocessImportController extends Controller {
  constructor(
    private readonly installedAppRepository: GetInstalledAppRepository,
    private readonly importRepository: ImportSheetImportRepository,
    private readonly runImportService: RunImportService,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const appId = req.appId as string
    const domainId = req.domainId as string

    const id = Number(req.params.id)
    if (!Number.isInteger(id)) return this.badRequest(new Error('Invalid id'))

    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) return this.badRequest(new Error('Invalid rows'))

    const app = await this.installedAppRepository.getByAppCodeAndDomainId(
      appId,
      domainId,
    )
    if (!app) return this.notFound(new Error('App not found'))

    const found = await this.importRepository.findById(id, app.id)
    if (!found) return this.notFound(new Error('Import not found'))

    if (await isImportRunInFlight(id)) {
      logImportsheetError(apiLogger, 'importsheet.reprocess.in_flight', {
        appId: app.id,
        importId: id,
      })
      return this.conflict(
        new Error('Importação está em execução — aguarde para reprocessar'),
      )
    }

    const result = await this.runImportService.reprocessRows(
      id,
      parsed.data.rows,
    )

    if (result.status === 'throttled') {
      return this.conflict(new Error('Bitrix sobrecarregado — tente novamente'))
    }
    if (result.status === 'skipped') {
      return this.conflict(new Error('Importação está em execução — aguarde'))
    }

    apiLogger.info(
      {
        app: 'importsheet',
        appId: app.id,
        importId: id,
        linhas: parsed.data.rows.length,
        errorRows: result.errorRows?.length ?? 0,
      },
      'Linhas reprocessadas',
    )

    return this.ok({ errorRows: result.errorRows })
  }
}
