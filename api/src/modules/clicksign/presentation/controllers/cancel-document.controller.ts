import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { CLICKSIGN_APP_CODE_ID } from '../../clicksign.constants'
import { ClickSignSettingsRepository } from '../../domain/repositories/clicksign-settings.repository'
import { CancelEnvelopeUseCase } from '../../application/cancel-envelope.use-case'
import { safeErrorMessage } from '../../infra/clients/clicksign-error'
import { clicksignError, logClicksignError } from '../../errors/catalog'
import { setLogContext } from '@/shared/infra/log-context'
import { apiLogger } from '@/shared/infra/logger'

export class CancelDocumentController extends Controller {
  constructor(
    private readonly getDomain: GetDomainRepository,
    private readonly getApp: GetInstalledAppRepository,
    private readonly settings: ClickSignSettingsRepository,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const body = req.body as CancelEventBody

    if (body?.data?.id !== 'cancelDocument') {
      return this.ok({ ignored: true })
    }

    const domainStr = body.auth?.domain
    if (!domainStr) throw clicksignError('clicksign.cancel.domain_missing')

    setLogContext({ domain: domainStr })

    // Guards borbulham pro funil; falha do use-case vira comentário na timeline (200).
    const domain = await this.getDomain.getDomain(domainStr)
    if (!domain) throw clicksignError('clicksign.cancel.domain_not_found')

    const app = await this.getApp.getByAppCodeAndDomainId(
      CLICKSIGN_APP_CODE_ID,
      domain.id,
    )
    if (!app) throw clicksignError('clicksign.cancel.app_not_found')

    const settings = await this.settings.findByAppId(app.id)
    if (!settings) throw clicksignError('clicksign.cancel.settings_not_found')

    const bitrix = await makeBitrixClientByAppId(app.id)
    const data = body.data

    try {
      await new CancelEnvelopeUseCase().execute({
        settings,
        bitrix,
        documentKey: data.documentKey,
        dealId: data.dealId,
        activityId: data.activityId,
        originId: data.originId,
        apiToken: data.apiToken,
        logoUri: data.logoUri,
        userId: body.auth?.user_id,
      })
    } catch (error) {
      logClicksignError(
        apiLogger,
        'clicksign.cancel.execution_failed',
        { app: 'clicksign', err: safeErrorMessage(error) },
        { level: 'error' },
      )
    }

    return this.ok({ received: true })
  }
}

interface CancelEventBody {
  data: {
    id?: string
    documentKey: string
    dealId: string | number
    activityId: string | number
    originId: string
    apiToken: string
    logoUri?: string
  }
  auth?: {
    domain?: string
    member_id?: string
    user_id?: string | number
  }
}
