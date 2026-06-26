import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { GoogleConnectionService } from '../../application/google-connection.service'
import { apiLogger } from '@/shared/infra/logger'

export class GoogleDisconnectController extends Controller {
  constructor(
    private readonly installedAppRepository: GetInstalledAppRepository,
    private readonly googleConnection: GoogleConnectionService,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    // Contexto e appCode já validados pelo requireImportSheetApp middleware.
    const appId = req.appId as string
    const domainId = req.domainId as string

    const app = await this.installedAppRepository.getByAppCodeAndDomainId(
      appId,
      domainId,
    )
    if (!app) return this.notFound(new Error('App not found'))

    await this.googleConnection.disconnect(app.id)

    apiLogger.info(
      { app: 'importsheet', appId: app.id },
      'Conexão Google desconectada',
    )

    return this.ok({ disconnected: true })
  }
}
