import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { ClickSignSettingsRepository } from '../../domain/repositories/clicksign-settings.repository'
import { clicksignError } from '../../errors/catalog'

const EMPTY = {
  fields: null,
  verifySettings: null,
  contactSettings: null,
  dealSettings: null,
  groups: null,
}

export class GetSettingsController extends Controller {
  constructor(
    private readonly installedAppRepository: GetInstalledAppRepository,
    private readonly settings: ClickSignSettingsRepository,
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
    if (!app) throw clicksignError('clicksign.settings.app_not_found')

    const settings = await this.settings.findByAppId(app.id)
    return this.ok({ settings: settings ?? EMPTY })
  }
}
