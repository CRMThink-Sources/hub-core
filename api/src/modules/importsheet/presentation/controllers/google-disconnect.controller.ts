import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { GoogleConnectionService } from '../../application/google-connection.service'
import { IMPORTSHEET_APP_CODE_ID } from '../../importsheet.constants'

export class GoogleDisconnectController extends Controller {
  constructor(
    private readonly installedAppRepository: GetInstalledAppRepository,
    private readonly googleConnection: GoogleConnectionService,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const appId = req.appId
    const domainId = req.domainId
    if (!appId || !domainId) {
      return this.badRequest(new Error('Missing app context'))
    }
    if (appId !== IMPORTSHEET_APP_CODE_ID) {
      return this.badRequest(new Error('Not an ImportSheet app'))
    }

    const app = await this.installedAppRepository.getByAppCodeAndDomainId(
      appId,
      domainId,
    )
    if (!app) return this.notFound(new Error('App not found'))

    await this.googleConnection.disconnect(app.id)
    return this.ok({ disconnected: true })
  }
}
