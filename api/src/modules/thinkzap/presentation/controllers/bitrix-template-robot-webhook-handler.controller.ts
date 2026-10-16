import type { InstallationLocaleRepository } from '@/modules/thinkzap/domain/ports/installation-locale.port'
import { DEFAULT_NOTICE_LOCALE } from '@/modules/thinkzap/domain/notices/notice-locale'
import { timelineNotices } from '@/modules/thinkzap/domain/notices/timeline-notices'
import { Request, Response } from 'express'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { SendNotification } from '@/shared/data/contracts/send-notification'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { apiLogger } from '@/shared/infra/logger'
import { EnqueueTemplateSendService } from '@/modules/thinkzap/application/enqueue-template-send.service'
import { ListWidgetTemplatesUseCase } from '@/modules/thinkzap/application/list-widget-templates'
import { resolveRobotTemplateBody } from '@/modules/thinkzap/application/resolve-robot-template-body'
import {
  bizprocEntityToPlacement,
  resolveRelatedDestinations,
} from '@/modules/thinkzap/application/related-destinations.resolver'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import {
  BizprocDocument,
  parseBizprocDocumentId,
} from './bitrix-robot-webhook-handler.controller'

// Só enfileira no outbox (o worker retenta): um 500 transitório perderia mensagem paga.
// Recusa de negócio responde 200 com motivo na timeline: o Bitrix não retenta robô; 404 só sem domínio/app.
export class BitrixTemplateRobotWebhookHandlerController extends Controller {
  constructor(
    private readonly getDomain: GetDomainRepository,
    private readonly getApp: GetInstalledAppRepository,
    private readonly enqueueTemplateSend: EnqueueTemplateSendService,
    private readonly listTemplates: ListWidgetTemplatesUseCase,
    private readonly sendNotification: SendNotification,
    private readonly bitrix: BitrixClient,
    /** Idioma dos comentários de timeline. Ausente, português. */
    private readonly locales: InstallationLocaleRepository | null = null,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const data = req.body as BitrixTemplateRobotWebhookRequest

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

    const documentId = data.document_id[2]
    if (!documentId) {
      return this.badRequest(new Error('Document ID not found'))
    }

    // Todo desfecho daqui em diante comenta na timeline, no idioma da instalação.
    const notices = timelineNotices(
      (await this.locales?.byAppId(app.id)) ?? DEFAULT_NOTICE_LOCALE,
    ).templateRobot

    // null fora de entidade CRM: ainda envia ao destino manual, só sem timeline nem relacionados.
    const crmDocument = parseBizprocDocumentId(documentId)

    const subscriptionItemId = data.properties.connector?.trim()
    const templateName = data.properties.templateName?.trim()
    const language = data.properties.templateLanguage?.trim()

    if (!subscriptionItemId || !templateName || !language) {
      return this.refuse(crmDocument, notices.incomplete, {
        reason: 'incomplete-configuration',
      })
    }

    const scope = {
      subscriptionItemId,
      domainId: domain.id,
      appCode: app.appCodeId,
    }

    // Valida a linha antes de resolver destinatários, para não gastar leitura de contatos.
    let target
    try {
      target = await this.enqueueTemplateSend.resolveTarget(scope)
    } catch (error) {
      logThinkzapError(apiLogger, 'thinkzap.bitrix.template_robot_refused', {
        app: 'thinkzap',
        source: 'bitrix',
        subscriptionItemId,
        err: (error as Error).message,
      })

      return this.refuse(
        crmDocument,
        notices.lineCannotSend((error as Error).message),
        { reason: 'line-refused' },
      )
    }

    const recipients = await this.resolveRecipients(data, crmDocument)
    if (recipients.length === 0) {
      return this.refuse(crmDocument, notices.noRecipients, {
        reason: 'no-recipients',
      })
    }

    // Uma vez por disparo: o fallback de catálogo custa uma consulta ao provider.
    const templateBody = await resolveRobotTemplateBody(
      {
        ...scope,
        name: templateName,
        language,
        configuredBody: data.properties.templateBody ?? '',
      },
      input => this.listTemplates.execute(input),
    )

    const bodyParameters = toParameterList(data.properties.templateParameters)

    const queued: string[] = []
    for (const destination of recipients) {
      try {
        const result = await this.enqueueTemplateSend.enqueue(target, {
          ...scope,
          destination,
          templateName,
          language,
          bodyParameters,
          templateBody,
          entity: crmDocument?.entity ?? '',
          entityId: crmDocument?.entityId ?? '',
        })
        queued.push(result.destination)
      } catch (error) {
        // Falha de um destinatário (ex.: telefone inválido) não cancela os demais.
        logThinkzapError(
          apiLogger,
          'thinkzap.bitrix.template_robot_enqueue_failed',
          {
            app: 'thinkzap',
            source: 'bitrix',
            subscriptionItemId,
            destination,
            err: (error as Error).message,
          },
        )
      }
    }

    if (queued.length === 0) {
      return this.refuse(crmDocument, notices.noValidRecipients, {
        reason: 'no-valid-recipients',
      })
    }

    await this.comment(
      crmDocument,
      notices.queued({ templateName, language, destinations: queued }),
    )

    return this.ok({ received: true, queued: queued.length })
  }

  private async refuse(
    document: BizprocDocument | null,
    message: string,
    context: Record<string, unknown>,
  ): Promise<httpResponse> {
    apiLogger.info(
      { app: 'thinkzap', source: 'bitrix', ...context },
      'template robot refused the run',
    )

    await this.comment(document, message)

    return this.ok({ received: true, queued: 0 })
  }

  private async comment(
    document: BizprocDocument | null,
    message: string,
  ): Promise<void> {
    if (!document) return

    try {
      await this.sendNotification.execute({
        contextId: document.entityId,
        entity: document.entity,
        message,
      })
    } catch (error) {
      // O aviso não é parte do envio: falhar aqui não vira erro de automação.
      logThinkzapError(
        apiLogger,
        'thinkzap.message.widget_send_notice_failed',
        { app: 'thinkzap', source: 'bitrix', err: error },
        { msg: 'falha ao comentar o desfecho do robô de template na timeline' },
      )
    }
  }

  // Alternância ligada ignora o destino manual; nasce desligada porque cada destinatário é template cobrado.
  private async resolveRecipients(
    data: BitrixTemplateRobotWebhookRequest,
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

        return [...new Set(destinations.map(destination => destination.phone))]
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

// Bitrix manda array, objeto indexado ou string crua; a ordem liga cada valor ao placeholder.
export function toParameterList(value: unknown): string[] {
  if (Array.isArray(value)) return (value as unknown[]).map(toParameterText)

  if (typeof value === 'string') return value ? [value] : []

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, item]) => toParameterText(item))
  }

  return []
}

// Valor aninhado vira vazio para `[object Object]` não chegar ao contato.
function toParameterText(item: unknown): string {
  if (typeof item === 'string') return item
  if (typeof item === 'number' || typeof item === 'boolean') return String(item)

  return ''
}

function isToggleOn(value: unknown): boolean {
  if (value === true) return true
  if (typeof value !== 'string') return false

  const normalized = value.trim().toUpperCase()
  return normalized === 'Y' || normalized === '1' || normalized === 'YES'
}

export interface BitrixTemplateRobotWebhookRequest {
  workflow_id: string
  code: string
  document_id: string[]
  document_type: string[]
  event_token: string
  properties: {
    /** Id do item de assinatura (a linha). */
    connector: string
    destination?: string
    sendToAllRelatedContacts?: string
    templateName: string
    templateLanguage: string
    /** Vazio cai no fallback de catálogo. */
    templateBody?: string
    /** Na ordem de aparição no corpo. */
    templateParameters?: string[] | Record<string, string> | string
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
