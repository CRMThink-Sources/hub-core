import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '../../domain/repositories/get-instance.repository'
import { ZApiClient } from '../../infra/clients/z-api.client'
import { env } from '@/config/env'
import { SendNotification } from '@/shared/data/contracts/send-notification'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  bizprocEntityToPlacement,
  resolveRelatedDestinations,
} from '../../application/related-destinations.resolver'

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
    private readonly sendNotification: SendNotification,
    private readonly bitrix: BitrixClient,
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

    const documentId = data.document_id[2]
    if (!documentId) {
      return this.badRequest(new Error('Document ID not found'))
    }
    const [entity, entityId] = documentId.split('_')
    if (!entityId || !entity) {
      return this.badRequest(new Error('Entity ID or entity not found'))
    }

    const recipients = await this.resolveRecipients(data, entity, entityId)

    const phoneData = await this.zApiClient.getPhoneData(
      instance.instanceId,
      instance.zApiToken || '',
    )
    const fromPhone = phoneData?.phone ?? 'desconhecido'

    if (recipients.length === 0) {
      await this.sendNotification.execute({
        contextId: entityId,
        entity,
        message: `De: ${fromPhone}\nNenhum destinatário encontrado para o envio.`,
      })
      return this.ok({ received: true, sent: 0 })
    }

    const sent: string[] = []
    for (const phone of recipients) {
      try {
        await this.zApiClient.sendMessage(
          instance.instanceId,
          instance.zApiToken || '',
          data.properties.message,
          phone,
        )
        sent.push(phone)
      } catch (error) {
        console.error(
          '[BitrixRobotWebhookHandler] failed to send to',
          phone,
          (error as Error).message,
        )
      }
    }

    await this.sendNotification.execute({
      contextId: entityId,
      entity,
      message: `De: ${fromPhone}\nPara: ${sent.join(', ')}\nMensagem: ${data.properties.message}`,
    })

    return this.ok({ received: true, sent: sent.length })
  }

  /**
   * Resolves the deduplicated list of recipient phones for this robot run.
   * When the "send to all related contacts" toggle is on, resolves every phone
   * related to the workflow entity and ignores the manual destination.
   * Otherwise falls back to the single manual destination (if any).
   */
  private async resolveRecipients(
    data: BitrixRobotWebhookHandlerRequest,
    entity: string,
    entityId: string,
  ): Promise<string[]> {
    if (isToggleOn(data.properties.sendToAllRelatedContacts)) {
      const placement = bizprocEntityToPlacement(entity)
      if (!placement) return []
      try {
        const { destinations } = await resolveRelatedDestinations(
          this.bitrix,
          placement,
          entityId,
        )
        return destinations.map(d => d.phone)
      } catch (error) {
        console.error(
          '[BitrixRobotWebhookHandler] failed to resolve related contacts:',
          (error as Error).message,
        )
        return []
      }
    }

    const destination = data.properties.destination?.trim()
    return destination ? [destination] : []
  }
}

function isToggleOn(value: unknown): boolean {
  if (value === true) return true
  if (typeof value !== 'string') return false
  const normalized = value.trim().toUpperCase()
  return normalized === 'Y' || normalized === '1' || normalized === 'YES'
}

interface BitrixRobotWebhookHandlerRequest {
  workflow_id: string
  code: string
  document_id: string[]
  document_type: string[]
  event_token: string
  properties: {
    connector: string //'82c08c50-f8f6-425c-9887-286029eb05e0',
    destination?: string //'11984342685',
    sendToAllRelatedContacts?: string //'Y' | 'N'
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
