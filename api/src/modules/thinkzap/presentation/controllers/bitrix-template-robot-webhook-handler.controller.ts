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

/**
 * `POST /api/thinkzap/webhooks/bitrix/template-robot` — o disparo do robô de **envio
 * de template**.
 *
 * Três coisas o separam do robô de envio livre, e todas as três vêm de template ser um
 * recurso cobrado do WhatsApp Oficial:
 *
 * 1. **Só linha HubMessage conectada dispara.** Z-API não tem template, e canal em
 *    conexão não tem catálogo. As duas recusas acontecem antes de qualquer
 *    destinatário ser resolvido.
 * 2. **Nada é entregue aqui.** O handler grava a intenção no outbox e enfileira; quem
 *    chama o provider é o worker, que já tem retentativa, lock por destino, histórico,
 *    conversa no canal aberto e aviso de falha na timeline. Um `500` transitório da
 *    HubMessage no meio de uma automação perderia uma mensagem paga.
 * 3. **Recusa de negócio responde `200`.** O Bitrix não retenta handler de robô, e um
 *    `5xx` só produziria um passo de automação com falha opaca. Quem configurou a
 *    automação lê a timeline da entidade, e é lá que o motivo é escrito. `404` fica
 *    para domínio e app inexistentes — aí não há timeline onde escrever.
 */
export class BitrixTemplateRobotWebhookHandlerController extends Controller {
  constructor(
    private readonly getDomain: GetDomainRepository,
    private readonly getApp: GetInstalledAppRepository,
    private readonly enqueueTemplateSend: EnqueueTemplateSendService,
    private readonly listTemplates: ListWidgetTemplatesUseCase,
    private readonly sendNotification: SendNotification,
    private readonly bitrix: BitrixClient,
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

    /**
     * `null` para workflow que não roda sobre entidade de CRM (lista universal, por
     * exemplo). Esses ainda enviam para destino manual; só não têm timeline onde
     * reportar, nem contatos relacionados a resolver.
     */
    const crmDocument = parseBizprocDocumentId(documentId)

    const subscriptionItemId = data.properties.connector?.trim()
    const templateName = data.properties.templateName?.trim()
    const language = data.properties.templateLanguage?.trim()

    if (!subscriptionItemId || !templateName || !language) {
      return this.refuse(
        crmDocument,
        'A automação está sem linha ou sem template escolhido. Abra a configuração do robô e escolha os dois.',
        { reason: 'incomplete-configuration' },
      )
    }

    const scope = {
      subscriptionItemId,
      domainId: domain.id,
      appCode: app.appCodeId,
    }

    /**
     * Escopo → habilitação → capacidade de provider → canal conectado, tudo antes de
     * resolver destinatário: um robô apontando para linha que não envia template não
     * deve gastar leitura de contatos, e o motivo tem de chegar ao usuário em vez de
     * virar envio silenciosamente perdido.
     */
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
        `A linha configurada não pode enviar template: ${(error as Error).message}`,
        { reason: 'line-refused' },
      )
    }

    const recipients = await this.resolveRecipients(data, crmDocument)
    if (recipients.length === 0) {
      return this.refuse(
        crmDocument,
        'Nenhum destinatário encontrado para o envio do template.',
        { reason: 'no-recipients' },
      )
    }

    /**
     * O corpo é resolvido **uma vez** por disparo, não por destinatário: ele não
     * depende de para quem se envia, e o fallback de catálogo custa uma consulta ao
     * provider.
     */
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
        /**
         * Falha de um destinatário não derruba os outros: telefone inválido num
         * contato relacionado é o caso comum, e ele não pode cancelar o envio para os
         * demais.
         */
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
      return this.refuse(
        crmDocument,
        'Nenhum destinatário válido para o envio do template.',
        { reason: 'no-valid-recipients' },
      )
    }

    await this.comment(
      crmDocument,
      `Template "${templateName}" (${language}) enfileirado para: ${queued.join(', ')}`,
    )

    return this.ok({ received: true, queued: queued.length })
  }

  /**
   * Recusa de negócio: `200` com `queued: 0` e o motivo na timeline.
   *
   * O Bitrix não retenta o handler de robô e não mostra corpo de resposta ao usuário —
   * responder erro aqui só trocaria uma explicação legível por um passo de automação
   * marcado como falho, sem dizer o quê.
   */
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

  /**
   * Registra o desfecho na entidade do workflow. No-op quando o workflow não roda
   * sobre entidade de CRM — não há dono para comentar.
   */
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
      // O aviso é observabilidade do usuário, não parte do envio: falhar aqui não
      // pode transformar um disparo enfileirado em erro de automação.
      apiLogger.warn(
        { app: 'thinkzap', source: 'bitrix', err: error },
        'falha ao comentar o desfecho do robô de template na timeline',
      )
    }
  }

  /**
   * Destinatários do disparo — mesma regra do robô de envio livre.
   *
   * Com a alternância ligada, resolve todos os telefones da entidade e **ignora** o
   * destino manual; desligada, usa só o destino manual. A alternância nasce desligada
   * porque cada destinatário resolvido é um template cobrado.
   */
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

/**
 * Propriedade múltipla do Bitrix chega como array, mas também como objeto indexado
 * (`{ '0': 'a', '1': 'b' }`) e, com um valor só, como string crua. As três formas
 * viram a mesma lista posicional — a ordem é o que liga cada valor ao seu placeholder.
 */
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

/**
 * Só primitivo vira texto. Valor aninhado — que o Bitrix não deveria mandar numa
 * propriedade de string — vira vazio em vez de `[object Object]`, que iria parar
 * dentro da mensagem que o contato lê.
 */
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
    /** Id do item de assinatura — a linha, como a tela grava. */
    connector: string
    /** Telefone literal, ou o valor que o Bitrix já resolveu do campo do documento. */
    destination?: string
    sendToAllRelatedContacts?: string
    templateName: string
    templateLanguage: string
    /** Corpo gravado pela tela; vazio cai no fallback de catálogo. */
    templateBody?: string
    /** Valores das variáveis, na ordem de aparição no corpo. */
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
