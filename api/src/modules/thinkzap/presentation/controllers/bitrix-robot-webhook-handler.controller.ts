import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '../../domain/repositories/get-instance.repository'
import { ZApiClient } from '../../infra/clients/z-api.client'
import { env } from '@/config/env'

export class BitrixRobotWebhookHandlerController extends Controller {
  private readonly zApiClient: ZApiClient = new ZApiClient(
    env.zApi.partnerToken,
    env.zApi.clientToken,
  )
  constructor(
    private readonly getDomain: GetDomainRepository,
    private readonly getApp: GetInstalledAppRepository,
    private readonly getConnector: GetConnectorRepository,
    private readonly getInstance: GetInstanceRepository,
  ) {
    super()
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const data = req.body as BitrixRobotWebhookHandlerRequest

    const domain = await this.getDomain.getDomain(data.auth.domain)
    if (!domain) {
      return this.notFound(new Error('Domain not found'))
    }

    const app = await this.getApp.getByAppCodeAndDomainId(
      'crmthink.thinkzap',
      domain.id,
    )
    if (!app) {
      return this.notFound(new Error('App not found'))
    }

    const connector = await this.getConnector.get(data.properties.connector)
    if (!connector) {
      return this.notFound(new Error('Connector not found'))
    }

    const instance = await this.getInstance.getInstance(connector.instanceId)
    if (!instance) {
      return this.notFound(new Error('Instance not found'))
    }

    await this.zApiClient.sendMessage(
      instance.instanceId,
      instance.zApiToken || '',
      data.properties.message,
      data.properties.destination,
    )

    await new Promise(resolve => setTimeout(resolve, 1000))
    return this.ok({ received: true })
  }
}

interface BitrixRobotWebhookHandlerRequest {
  workflow_id: string
  code: string
  document_id: string[]
  document_type: string[]
  event_token: string
  properties: {
    connector: string //'82c08c50-f8f6-425c-9887-286029eb05e0',
    destination: string //'11984342685',
    message: string //'Testando envio user_870'
  }
  use_subscription: 'N' | 'Y'
  timeout_duration: string
  ts: string
  auth: {
    access_token: string
    expires: string
    expires_in: string
    scope: string
    domain: string
    server_endpoint: string
    status: 'L' | 'S' | 'E'
    client_endpoint: string
    member_id: string
    user_id: string
    refresh_token: string
    application_token: string
  }
}
