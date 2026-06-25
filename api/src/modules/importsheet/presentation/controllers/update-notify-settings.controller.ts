import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { BitrixAppOptionService } from '@/shared/application/bitrix-app-option.service'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { NotifySettingsService } from '../../application/notify-settings.service'
import { apiLogger } from '@/shared/infra/logger'

export class UpdateNotifySettingsController extends Controller {
  constructor(
    private readonly installedAppRepository: GetInstalledAppRepository,
    private readonly bitrix: BitrixClient,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const appCodeId = req.appId as string
    const domainId = req.domainId as string

    const raw = (req.body as { userIds?: unknown })?.userIds
    if (!Array.isArray(raw) || !raw.every(n => Number.isInteger(Number(n)))) {
      return this.badRequest(new Error('userIds deve ser um array de inteiros'))
    }

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
      const userIds = await service.set(raw.map(Number))
      apiLogger.info(
        { app: 'importsheet', appId: app.id, usuarios: userIds.length },
        'Configurações de notificação salvas',
      )
      return this.ok({ userIds })
    } catch (error) {
      if (error instanceof BitrixError) return this.badRequest(error)
      throw error
    }
  }
}
