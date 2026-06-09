import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { GetSpreadsheetService } from '../../application/get-spreadsheet.service'
import { GoogleAuthRequiredError } from '../../domain/errors/google-auth-required.error'
import { GoogleUnavailableError } from '../../domain/errors/google-unavailable.error'

export class GetSpreadsheetController extends Controller {
  constructor(
    private readonly installedAppRepository: GetInstalledAppRepository,
    private readonly getSpreadsheet: GetSpreadsheetService,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    // Contexto e appCode já validados pelo requireImportSheetApp middleware.
    const appId = req.appId as string
    const domainId = req.domainId as string

    const rawId = req.params.spreadsheetId
    const spreadsheetId = (
      Array.isArray(rawId) ? (rawId[0] ?? '') : (rawId ?? '')
    ).trim()
    if (!spreadsheetId) {
      return this.badRequest(new Error('Missing spreadsheet id'))
    }

    const app = await this.installedAppRepository.getByAppCodeAndDomainId(
      appId,
      domainId,
    )
    if (!app) return this.notFound(new Error('App not found'))

    try {
      const spreadsheet = await this.getSpreadsheet.execute(
        app.id,
        spreadsheetId,
      )
      if (!spreadsheet) {
        return this.notFound(
          new Error(
            'Planilha não encontrada ou sem acesso pela conta conectada.',
          ),
        )
      }
      return this.ok({ spreadsheet })
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
