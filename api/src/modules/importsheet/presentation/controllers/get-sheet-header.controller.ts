import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { GetSheetHeaderService } from '../../application/get-sheet-header.service'
import { importsheetError } from '../../errors/catalog'

export class GetSheetHeaderController extends Controller {
  constructor(
    private readonly installedAppRepository: GetInstalledAppRepository,
    private readonly getSheetHeader: GetSheetHeaderService,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const appId = req.appId as string
    const domainId = req.domainId as string

    const rawId = req.params.spreadsheetId
    const spreadsheetId = (
      Array.isArray(rawId) ? (rawId[0] ?? '') : (rawId ?? '')
    ).trim()
    if (!spreadsheetId) {
      return this.badRequest(new Error('Missing spreadsheet id'))
    }

    const rawTab = req.query.tab
    const tabTitle = (typeof rawTab === 'string' ? rawTab : '').trim()
    if (!tabTitle) {
      return this.badRequest(new Error('Missing tab'))
    }

    const app = await this.installedAppRepository.getByAppCodeAndDomainId(
      appId,
      domainId,
    )
    if (!app) return this.notFound(new Error('App not found'))

    // Erros Google são AppError → borbulham pro funil (loga errorCode + responde).
    const header = await this.getSheetHeader.execute(
      app.id,
      spreadsheetId,
      tabTitle,
    )
    if (!header) {
      throw importsheetError('importsheet.sheet.not_found_or_forbidden')
    }
    if (header.columns.length === 0) {
      throw importsheetError('importsheet.sheet.header_empty')
    }
    return this.ok({ header })
  }
}
