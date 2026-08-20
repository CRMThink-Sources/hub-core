import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import {
  assertLineEnabled,
  findLineInContext,
} from '@/modules/thinkzap/application/helpers/resolve-line-by-subscription-item'
import { ZApiClient } from '../../infra/clients/z-api.client'
import { env } from '@/config/env'
import { SendNotification } from '@/shared/data/contracts/send-notification'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  bizprocEntityToPlacement,
  resolveRelatedDestinations,
} from '../../application/related-destinations.resolver'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '../../errors/catalog'

export class BitrixRobotWebhookHandlerController extends Controller {
  private readonly zApiClient: ZApiClient = new ZApiClient(
    env.zApi.partnerToken,
    env.zApi.clientToken,
  )
  constructor(
    private readonly getDomain: GetDomainRepository,
    private readonly getApp: GetInstalledAppRepository,
    private readonly getAplicationContext: GetAplicationContext,
    private readonly sendNotification: SendNotification,
    private readonly bitrix: BitrixClient,
  ) {
    super()
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const data = req.body as BitrixRobotWebhookHandlerRequest
    const domain = await this.getDomain.getDomain(data.auth.domain)
    if (!domain) {
      logThinkzapError(apiLogger, 'thinkzap.app.not_found', {
        app: 'thinkzap',
        source: 'bitrix',
        reason: 'domain',
      })
      return this.notFound(new Error('Domain not found'))
    }

    const app = await this.getApp.getByAppCodeAndDomainId(
      'crmthink.thinkzap',
      domain.id,
    )
    if (!app) {
      logThinkzapError(apiLogger, 'thinkzap.app.not_found', {
        app: 'thinkzap',
        source: 'bitrix',
        reason: 'app',
      })
      return this.notFound(new Error('App not found'))
    }

    /**
     * A opção do robô carrega o **id do item de assinatura**, não o do conector —
     * ver `syncThinkzapRobotConnectorOptions`. `Connector` saiu do caminho: linha
     * nascida na SPA não tem row naquela tabela, então o robô não conseguia enviar
     * por ela.
     */
    const context = await this.getAplicationContext.execute({
      domainId: domain.id,
      appCode: app.appCodeId,
    })

    /**
     * Recusa antes de resolver recipients e credencial: um robô apontando para linha
     * bloqueada não deve disparar nada, e o erro tem que aparecer no log do workflow
     * em vez de virar envio silenciosamente perdido.
     */
    assertLineEnabled(context, data.properties.connector, new Date())

    const line = findLineInContext(context, data.properties.connector)

    const documentId = data.document_id[2]
    if (!documentId) {
      return this.badRequest(new Error('Document ID not found'))
    }

    // Null for workflows that are not attached to a CRM entity (universal
    // lists, for instance). Those still send the message; they just have no
    // CRM timeline to comment on.
    const crmDocument = parseBizprocDocumentId(documentId)

    const recipients = await this.resolveRecipients(data, crmDocument)

    const phoneData = await this.zApiClient.getPhoneData(
      line.zApiInstanceId,
      line.zApiInstanceToken,
    )
    const fromPhone = phoneData?.phone ?? 'desconhecido'

    if (recipients.length === 0) {
      await this.commentOnCrmTimeline(
        crmDocument,
        `De: ${fromPhone}\nNenhum destinatário encontrado para o envio.`,
      )
      return this.ok({ received: true, sent: 0 })
    }

    const sent: string[] = []
    for (const phone of recipients) {
      try {
        await this.zApiClient.sendMessage(
          line.zApiInstanceId,
          line.zApiInstanceToken,
          data.properties.message,
          phone,
        )
        sent.push(phone)
      } catch (error) {
        logThinkzapError(apiLogger, 'thinkzap.bitrix.robot_webhook_failed', {
          app: 'thinkzap',
          source: 'bitrix',
          phone,
          err: (error as Error).message,
        })
      }
    }

    await this.commentOnCrmTimeline(
      crmDocument,
      `De: ${fromPhone}\nPara: ${sent.join(', ')}\nMensagem: ${data.properties.message}`,
    )

    return this.ok({ received: true, sent: sent.length })
  }

  /**
   * Records the run on the CRM entity timeline. No-op when the workflow does
   * not run on a CRM entity — there is no owner to comment on.
   */
  private async commentOnCrmTimeline(
    document: BizprocDocument | null,
    message: string,
  ): Promise<void> {
    if (!document) return

    await this.sendNotification.execute({
      contextId: document.entityId,
      entity: document.entity,
      message,
    })
  }

  /**
   * Resolves the deduplicated list of recipient phones for this robot run.
   * When the "send to all related contacts" toggle is on, resolves every phone
   * related to the workflow entity and ignores the manual destination.
   * Otherwise falls back to the single manual destination (if any).
   */
  private async resolveRecipients(
    data: BitrixRobotWebhookHandlerRequest,
    document: BizprocDocument | null,
  ): Promise<string[]> {
    if (isToggleOn(data.properties.sendToAllRelatedContacts)) {
      if (!document) return []
      const placement = bizprocEntityToPlacement(document.entity)
      if (!placement) return []
      try {
        const { destinations } = await resolveRelatedDestinations(
          this.bitrix,
          placement,
          document.entityId,
        )
        return destinations.map(d => d.phone)
      } catch (error) {
        logThinkzapError(
          apiLogger,
          'thinkzap.message.related_destinations_failed',
          { app: 'thinkzap', source: 'bitrix', err: (error as Error).message },
        )
        return []
      }
    }

    const destination = data.properties.destination?.trim()
    return destination ? [destination] : []
  }
}

export type BizprocDocument = {
  entity: string
  entityId: string
}

/**
 * Splits a Bizproc `document_id` token into the CRM owner type and element id.
 *
 * Standard entities look like `DEAL_10` (owner type `DEAL`). Smart Process
 * items look like `DYNAMIC_183_9`, where the owner type Bitrix expects is the
 * whole `DYNAMIC_183` prefix — splitting on the first `_` yields `DYNAMIC`,
 * which `CCrmOwnerType::ResolveID` rejects with "Owner not found".
 *
 * Returns null when the token is not a CRM owner at all: universal list
 * documents arrive as a bare element id (`68082`), and those workflows have no
 * CRM timeline to write to.
 */
export function parseBizprocDocumentId(
  documentId: string,
): BizprocDocument | null {
  const separatorIndex = documentId.lastIndexOf('_')
  if (separatorIndex <= 0) return null

  const entity = documentId.slice(0, separatorIndex)
  const entityId = documentId.slice(separatorIndex + 1)

  if (!entity || !/^\d+$/.test(entityId)) return null

  return { entity, entityId }
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
