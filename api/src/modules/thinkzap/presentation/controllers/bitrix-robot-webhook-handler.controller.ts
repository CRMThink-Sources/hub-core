import type { DailySendQuota } from '@/modules/thinkzap/domain/ports/daily-send-quota.port'
import type { InstallationLocaleRepository } from '@/modules/thinkzap/domain/ports/installation-locale.port'
import {
  DEFAULT_NOTICE_LOCALE,
  dailyLimitNotices,
} from '@/modules/thinkzap/domain/daily-limit-notices'
import { timelineNotices } from '@/modules/thinkzap/domain/notices/timeline-notices'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import {
  dailyLimitPolicyOf,
  isDailyLimitReachedError,
  sendWithinDailyQuota,
} from '@/modules/thinkzap/application/helpers/send-within-daily-quota'
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
import type {
  SendRobotFileFailure,
  SendRobotFilesResult,
} from '@/modules/thinkzap/domain/notices/timeline-notices'
import type { OutboundMessageDescriptor } from '@/modules/thinkzap/domain/ports/outbound-message-sender.port'
import { buildCaptionedParts } from '../../application/helpers/build-captioned-parts'
import { parseRobotFiles } from '../../application/robot-files/parse-robot-files'
import {
  downloadRobotFile,
  fetchRobotFiles,
  type RobotFileDeps,
  type RobotFileResult,
} from '../../application/robot-files/fetch-robot-files'
import { ZApiOutboundSender } from '../../infra/adapters/z-api-outbound-sender.adapter'

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
    /** Ausente, o envio não é contado nem limitado. A factory sempre injeta. */
    private readonly quota: DailySendQuota | null = null,
    /** Idioma do aviso de limite na timeline. Ausente, português. */
    private readonly locales: InstallationLocaleRepository | null = null,
    /** Leitura dos arquivos do robô. Ausente, `crm.item.get` deste portal + download HTTP. */
    private readonly files: RobotFileDeps | null = null,
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

    // Idioma da instalação para o comentário da timeline (sempre há um, com documento).
    const locale =
      (await this.locales?.byAppId(app.id)) ?? DEFAULT_NOTICE_LOCALE
    const notices = timelineNotices(locale)

    // Mensagem só de espaços conta como vazia: com arquivo, eles vão sem legenda.
    const message = data.properties.message?.trim()
      ? data.properties.message
      : ''
    const fileIds = parseRobotFiles(data.properties.file)

    if (!message && fileIds.length === 0) {
      await this.commentOnCrmTimeline(crmDocument, notices.sendRobot.noContent)
      return this.ok({ received: true, sent: 0 })
    }

    const recipients = await this.resolveRecipients(data, crmDocument)

    const phoneData = await this.zApiClient.getPhoneData(
      line.zApiInstanceId,
      line.zApiInstanceToken,
    )
    const fromPhone = phoneData?.phone ?? notices.sendRobot.unknownPhone

    if (recipients.length === 0) {
      await this.commentOnCrmTimeline(
        crmDocument,
        notices.sendRobot.noRecipients(fromPhone),
      )
      return this.ok({ received: true, sent: 0 })
    }

    const dailyLimitPolicy = dailyLimitPolicyOf({
      provider: ConnectorProvider.ZAPI,
      lineKey: line.zApiInstanceId,
      settings: line.item.settings,
    })

    // Uma vez por disparo, não por destinatário.
    const files = await fetchRobotFiles(this.fileDeps(), crmDocument, fileIds)
    const parts = buildCaptionedParts(message || undefined, toMedia(files))

    const sent: string[] = []
    // Recusados pelo limite diário: listados na timeline, para o cliente saber quem ficou sem.
    const refusedByLimit: string[] = []
    const acceptedFiles = new Set<string>()
    const providerFailedFiles = new Set<string>()

    for (const phone of recipients) {
      const sender = new ZApiOutboundSender(this.zApiClient, {
        instanceId: line.zApiInstanceId,
        instanceToken: line.zApiInstanceToken,
        phone,
      })
      let delivered = false
      let refused = false

      // Cada parte reserva a sua vaga: uma recusa interrompe só este destinatário.
      for (const part of parts) {
        try {
          const send = (): Promise<unknown> =>
            part.kind === 'text'
              ? this.zApiClient.sendMessage(
                  line.zApiInstanceId,
                  line.zApiInstanceToken,
                  part.text ?? '',
                  phone,
                )
              : sender.send(part)
          await (this.quota
            ? sendWithinDailyQuota(this.quota, dailyLimitPolicy, send)
            : send())
          delivered = true
          if (part.kind !== 'text' && part.fileName) {
            acceptedFiles.add(part.fileName)
          }
        } catch (error) {
          if (isDailyLimitReachedError(error)) {
            refused = true
            break
          }
          if (part.kind !== 'text' && part.fileName) {
            providerFailedFiles.add(part.fileName)
          }
          logThinkzapError(apiLogger, 'thinkzap.bitrix.robot_webhook_failed', {
            app: 'thinkzap',
            source: 'bitrix',
            phone,
            kind: part.kind,
            err: (error as Error).message,
          })
        }
      }

      if (refused) refusedByLimit.push(phone)
      else if (delivered) sent.push(phone)
    }

    if (refusedByLimit.length > 0) {
      logThinkzapError(
        apiLogger,
        'thinkzap.line.daily_limit_reached',
        {
          app: 'thinkzap',
          source: 'bitrix',
          refusedCount: refusedByLimit.length,
        },
        { msg: 'Robô de envio: destinatários recusados pelo limite diário' },
      )
    }

    await this.commentOnCrmTimeline(
      crmDocument,
      notices.sendRobot.result({
        fromPhone,
        sent,
        message,
        ...(fileIds.length > 0 && {
          files: filesOutcome(files, acceptedFiles, providerFailedFiles),
        }),
      }) +
        (refusedByLimit.length > 0
          ? '\n' + dailyLimitNotices(locale).robotRefused(refusedByLimit)
          : ''),
    )

    return this.ok({
      received: true,
      sent: sent.length,
      ...(refusedByLimit.length > 0 && {
        refusedByDailyLimit: refusedByLimit.length,
      }),
    })
  }

  private fileDeps(): RobotFileDeps {
    return (
      this.files ?? {
        getCrmItem: (entityTypeId, id) =>
          this.bitrix.getCrmItem(entityTypeId, id),
        download: downloadRobotFile,
      }
    )
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

/** Arquivos baixados viram partes de mídia; o nome identifica o arquivo na timeline. */
function toMedia(files: RobotFileResult[]): OutboundMessageDescriptor[] {
  return files.flatMap(file =>
    file.status === 'ok'
      ? [
          {
            kind: file.kind,
            url: file.dataUrl,
            fileName: file.name,
            mime: file.mime,
          },
        ]
      : [],
  )
}

/**
 * Enviados: aceitos pelo provider para algum destinatário. Não enviados: os que não
 * saíram do Bitrix e os que o provider recusou para todos. Arquivo que ficou para
 * trás só pelo limite diário não entra — o destinatário já aparece como recusado.
 */
function filesOutcome(
  files: RobotFileResult[],
  accepted: Set<string>,
  providerFailed: Set<string>,
): SendRobotFilesResult {
  const failed: { name: string; reason: SendRobotFileFailure }[] = []
  const sent: string[] = []

  for (const file of files) {
    if (file.status === 'failed') {
      failed.push({ name: file.name, reason: file.reason })
    } else if (accepted.has(file.name)) {
      sent.push(file.name)
    } else if (providerFailed.has(file.name)) {
      failed.push({ name: file.name, reason: 'send_failed' })
    }
  }

  return { sent, failed }
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
    /** Opcional com arquivo: vira legenda, ou fica de fora. */
    message?: string //'Testando envio user_870'
    /** Ids de arquivo do portal — ver `parseRobotFiles`. */
    file?: unknown //['422204', '422206']
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
