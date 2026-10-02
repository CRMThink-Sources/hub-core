import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { apiLogger } from '@/shared/infra/logger'
import { logImportsheetError } from '../../errors/catalog'
import { BitrixAppOptionService } from '@/shared/application/bitrix-app-option.service'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { NotifySettingsService } from '../../application/notify-settings.service'

export class GetNotifySettingsController extends Controller {
  constructor(
    private readonly installedAppRepository: GetInstalledAppRepository,
    private readonly bitrix: BitrixClient,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const appCodeId = req.appId as string
    const domainId = req.domainId as string

    const app = await this.installedAppRepository.getByAppCodeAndDomainId(
      appCodeId,
      domainId,
    )
    if (!app) return this.notFound(new Error('App not found'))

    try {
      const service = new NotifySettingsService(
        new BitrixAppOptionService(this.bitrix),
        app.id,
      )
      return this.ok({ userIds: await service.get() })
    } catch (error) {
      if (error instanceof BitrixError) {
        logImportsheetError(apiLogger, 'importsheet.settings.bitrix_error', {
          app: 'importsheet',
          err: error,
        })
        return this.badRequest(error)
      }
      throw error
    }
  }
}
