import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { GetSheetHeaderService } from '../../application/get-sheet-header.service'
import { GoogleAuthRequiredError } from '../../domain/errors/google-auth-required.error'
import { GoogleUnavailableError } from '../../domain/errors/google-unavailable.error'

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

    try {
      const header = await this.getSheetHeader.execute(
        app.id,
        spreadsheetId,
        tabTitle,
      )
      if (!header) {
        return this.notFound(
          new Error('Planilha ou aba não encontrada, ou sem acesso.'),
        )
      }
      return this.ok({ header })
    } catch (error) {
      if (error instanceof GoogleAuthRequiredError) {
        return this.unauthorized(error)
      }
      if (error instanceof GoogleUnavailableError) {
        return this.gatewayTimeout(error)
      }
      throw error
    }
  }
}
