import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { CLICKSIGN_APP_CODE_ID } from '../../clicksign.constants'
import { ClickSignSettingsRepository } from '../../domain/repositories/clicksign-settings.repository'
import {
  RobotProps,
  SendEnvelopeUseCase,
} from '../../application/send-envelope.use-case'
import { safeErrorMessage } from '../../infra/clients/clicksign-error'
import { clicksignError, logClicksignError } from '../../errors/catalog'
import { setLogContext } from '@/shared/infra/log-context'
import { apiLogger } from '@/shared/infra/logger'

export class SendEnvelopeController extends Controller {
  constructor(
    private readonly getDomain: GetDomainRepository,
    private readonly getApp: GetInstalledAppRepository,
    private readonly settings: ClickSignSettingsRepository,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const body = req.body as RobotWebhookBody

    if (!body?.auth?.access_token || !body?.auth?.domain) {
      throw clicksignError('clicksign.send.robot_auth_missing')
    }

    setLogContext({ domain: body.auth.domain })

    const documentId = body.document_id?.[2]
    const [entity, entityId] = documentId?.split('_') ?? []
    if (!entity || !entityId) {
      throw clicksignError('clicksign.send.document_id_invalid')
    }

    const bitrix = new BitrixRestClient(
      body.auth.domain,
      body.auth.access_token,
    )

    // Libera o bizproc imediatamente (robô é subscription) para evitar timeout.
    await this.releaseSubscription(bitrix, body)

    try {
      const settings = await this.resolveSettings(body.auth.domain)
      if (settings) {
        await new SendEnvelopeUseCase().execute({
          settings,
          props: body.properties,
          entity,
          entityId,
          domain: body.auth.domain,
          token: body.auth.access_token,
          bitrix,
        })
      } else {
        logClicksignError(apiLogger, 'clicksign.send.settings_not_found', {
          app: 'clicksign',
        })
      }
    } catch (error) {
      logClicksignError(
        apiLogger,
        'clicksign.send.execution_failed',
        { app: 'clicksign', err: safeErrorMessage(error) },
        { level: 'error' },
      )
    }

    return this.ok({ received: true })
  }

  private async resolveSettings(domainStr: string) {
    const domain = await this.getDomain.getDomain(domainStr)
    if (!domain) return null
    const app = await this.getApp.getByAppCodeAndDomainId(
      CLICKSIGN_APP_CODE_ID,
      domain.id,
    )
    if (!app) return null
    return this.settings.findByAppId(app.id)
  }

  private async releaseSubscription(
    bitrix: BitrixRestClient,
    body: RobotWebhookBody,
  ): Promise<void> {
    if (body.use_subscription !== 'Y' || !body.event_token) return
    try {
      await bitrix.callMethod('bizproc.event.send', {
        event_token: body.event_token,
      })
    } catch (error) {
      logClicksignError(
        apiLogger,
        'clicksign.send.bizproc_release_failed',
        { app: 'clicksign', err: safeErrorMessage(error) },
        { level: 'error' },
      )
    }
  }
}

interface RobotWebhookBody {
  document_id: string[]
  event_token?: string
  use_subscription?: 'N' | 'Y'
  properties: RobotProps
  auth: {
    access_token: string
    domain: string
    member_id: string
    refresh_token: string
    client_endpoint: string
  }
}
