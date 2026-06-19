import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { ClickSignSettingsRepository } from '../../domain/repositories/clicksign-settings.repository'
import { settingsPatchSchema } from './settings-payload.schema'

export class UpdateSettingsController extends Controller {
  constructor(
    private readonly installedAppRepository: GetInstalledAppRepository,
    private readonly settings: ClickSignSettingsRepository,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const appCodeId = req.appId as string
    const domainId = req.domainId as string

    const parsed = settingsPatchSchema.safeParse(req.body)
    if (!parsed.success) {
      return this.badRequest(
        new Error(parsed.error.issues[0]?.message ?? 'Body inválido'),
      )
    }

    const app = await this.installedAppRepository.getByAppCodeAndDomainId(
      appCodeId,
      domainId,
    )
    if (!app) return this.notFound(new Error('App not found'))

    const settings = await this.settings.upsertByAppId(app.id, parsed.data)
    return this.ok({ settings })
  }
}
