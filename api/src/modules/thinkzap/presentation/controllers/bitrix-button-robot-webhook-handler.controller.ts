import { Request, Response } from 'express'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { SendNotification } from '@/shared/data/contracts/send-notification'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { apiLogger } from '@/shared/infra/logger'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ButtonAction } from '@/modules/thinkzap/domain/ports/interactive-button-sender.port'
import { assertValidButtonsForProvider } from '@/modules/thinkzap/domain/ports/interactive-button-validation'
import { EnqueueInteractiveButtonSendService } from '@/modules/thinkzap/application/enqueue-interactive-button-send.service'
import {
  bizprocEntityToPlacement,
  resolveRelatedDestinations,
} from '@/modules/thinkzap/application/related-destinations.resolver'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import {
  BizprocDocument,
  parseBizprocDocumentId,
} from './bitrix-robot-webhook-handler.controller'
import { toParameterList } from './bitrix-template-robot-webhook-handler.controller'

/**
 * Base compartilhada dos dois robôs de botão (`POST
 * /api/thinkzap/webhooks/bitrix/button-robot-official` e `-unofficial`).
 *
 * Uma classe só, parametrizada por `expectedProvider`: as `PROPERTIES` e o
 * fluxo de resolução são idênticos nos dois robôs (mirror de
 * `EnsureButtonRobot`); o que diverge é qual provider aquele robô aceita — e é
 * essa checagem, feita logo após resolver a linha, que impede o robô oficial
 * de disparar numa linha Z-API (e vice-versa).
 *
 * Mesmas três decisões do robô de template, pelos mesmos motivos: nada é
 * entregue aqui (o outbox e o worker cuidam disso), e recusa de negócio
 * responde `200` — o Bitrix não retenta handler de robô.
 */
export class BitrixButtonRobotWebhookHandlerController extends Controller {
  constructor(
    private readonly getDomain: GetDomainRepository,
    private readonly getApp: GetInstalledAppRepository,
    private readonly enqueueButtonSend: EnqueueInteractiveButtonSendService,
    private readonly sendNotification: SendNotification,
    private readonly bitrix: BitrixClient,
    private readonly expectedProvider: ConnectorProvider,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const data = req.body as BitrixButtonRobotWebhookRequest

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

    const crmDocument = parseBizprocDocumentId(documentId)

    const subscriptionItemId = data.properties.connector?.trim()
    const body = data.properties.body?.trim()
    const buttons = parseButtonList(data.properties.buttons)

    if (!subscriptionItemId || !body || buttons.length === 0) {
      return this.refuse(
        crmDocument,
        'A automação está sem linha, sem corpo ou sem nenhum botão configurado. Abra a configuração do robô e preencha os três.',
        { reason: 'incomplete-configuration' },
      )
    }

    const scope = {
      subscriptionItemId,
      domainId: domain.id,
      appCode: app.appCodeId,
    }

    let target
    try {
      target = await this.enqueueButtonSend.resolveTarget(scope)
    } catch (error) {
      logThinkzapError(apiLogger, 'thinkzap.bitrix.button_robot_refused', {
        app: 'thinkzap',
        source: 'bitrix',
        subscriptionItemId,
        err: (error as Error).message,
      })

      return this.refuse(
        crmDocument,
        `A linha configurada não pode enviar botões: ${(error as Error).message}`,
        { reason: 'line-refused' },
      )
    }

    if (target.provider !== this.expectedProvider) {
      return this.refuse(
        crmDocument,
        `A linha configurada é ${target.provider}, mas este robô só dispara para linha ${this.expectedProvider}.`,
        { reason: 'provider-mismatch' },
      )
    }

    try {
      assertValidButtonsForProvider(target.provider, buttons)
    } catch (error) {
      logThinkzapError(apiLogger, 'thinkzap.bitrix.button_robot_refused', {
        app: 'thinkzap',
        source: 'bitrix',
        subscriptionItemId,
        err: (error as Error).message,
      })

      return this.refuse(crmDocument, (error as Error).message, {
        reason: 'invalid-buttons',
      })
    }

    const recipients = await this.resolveRecipients(data, crmDocument)
    if (recipients.length === 0) {
      return this.refuse(
        crmDocument,
        'Nenhum destinatário encontrado para o envio da mensagem com botões.',
        { reason: 'no-recipients' },
      )
    }

    const header = data.properties.header?.trim() || undefined
    const footer = data.properties.footer?.trim() || undefined

    const queued: string[] = []
    for (const destination of recipients) {
      try {
        const result = await this.enqueueButtonSend.enqueue(target, {
          ...scope,
          destination,
          body,
          header,
          footer,
          buttons,
          entity: crmDocument?.entity ?? '',
          entityId: crmDocument?.entityId ?? '',
        })
        queued.push(result.destination)
      } catch (error) {
        /**
         * Falha de um destinatário não derruba os outros: telefone inválido num
         * contato relacionado é o caso comum, e ele não pode cancelar o envio para os
         * demais.
         */
        logThinkzapError(
          apiLogger,
          'thinkzap.bitrix.button_robot_enqueue_failed',
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
      return this.refuse(
        crmDocument,
        'Nenhum destinatário válido para o envio da mensagem com botões.',
        { reason: 'no-valid-recipients' },
      )
    }

    await this.comment(
      crmDocument,
      `Mensagem com botões enfileirada para: ${queued.join(', ')}`,
    )

    return this.ok({ received: true, queued: queued.length })
  }

  /**
   * Recusa de negócio: `200` com `queued: 0` e o motivo na timeline. Mirror do
   * robô de template — mesmo raciocínio.
   */
  private async refuse(
    document: BizprocDocument | null,
    message: string,
    context: Record<string, unknown>,
  ): Promise<httpResponse> {
    apiLogger.info(
      { app: 'thinkzap', source: 'bitrix', ...context },
      'button robot refused the run',
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
      apiLogger.warn(
        { app: 'thinkzap', source: 'bitrix', err: error },
        'falha ao comentar o desfecho do robô de botão na timeline',
      )
    }
  }

  /** Destinatários do disparo — mesma regra dos outros dois robôs. */
  private async resolveRecipients(
    data: BitrixButtonRobotWebhookRequest,
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

/**
 * Cada entrada da propriedade múltipla `buttons` é `"tipo|label|url-ou-telefone"`
 * — o terceiro campo vazio para `REPLY`, que não usa valor extra. Entrada sem
 * tipo reconhecido ou sem label é descartada, não derruba as demais.
 */
export function parseButtonList(value: unknown): ButtonAction[] {
  return toParameterList(value)
    .map((raw, index) => parseButtonEntry(raw, index))
    .filter((button): button is ButtonAction => button !== null)
}

function parseButtonEntry(raw: string, index: number): ButtonAction | null {
  const [rawType, rawLabel, rawValue] = raw.split('|')
  const type = rawType?.trim().toUpperCase()
  const label = rawLabel?.trim()
  const value = rawValue?.trim()

  if (!label) return null

  const id = String(index + 1)

  if (type === 'URL') return { id, label, type: 'URL', url: value ?? '' }
  if (type === 'CALL') return { id, label, type: 'CALL', phone: value ?? '' }
  if (type === 'REPLY') return { id, label, type: 'REPLY' }

  return null
}

function isToggleOn(value: unknown): boolean {
  if (value === true) return true
  if (typeof value !== 'string') return false

  const normalized = value.trim().toUpperCase()
  return normalized === 'Y' || normalized === '1' || normalized === 'YES'
}

export interface BitrixButtonRobotWebhookRequest {
  workflow_id: string
  code: string
  document_id: string[]
  document_type: string[]
  event_token: string
  properties: {
    /** Id do item de assinatura — a linha, como a tela grava. */
    connector: string
    /** Telefone literal, ou o valor que o Bitrix já resolveu do campo do documento. */
    destination?: string
    sendToAllRelatedContacts?: string
    body: string
    header?: string
    footer?: string
    /** Um por linha, `"tipo|label|url-ou-telefone"`. */
    buttons?: string[] | Record<string, string> | string
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
