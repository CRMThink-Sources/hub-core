import { Request, Response } from 'express'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import type { BitrixMethodCaller } from '@/shared/infra/clients/call-bitrix-idempotent'
import { apiLogger } from '@/shared/infra/logger'
import { EnqueueTemplateSendService } from '@/modules/thinkzap/application/enqueue-template-send.service'
import { EnqueueWidgetMessageUseCase } from '@/modules/thinkzap/application/enqueue-widget-message.use-case'
import { ListWidgetTemplatesUseCase } from '@/modules/thinkzap/application/list-widget-templates'
import { reportSmsMessageStatus } from '@/modules/thinkzap/application/report-sms-message-status'
import { parseSmsTemplateValues } from '@/modules/thinkzap/application/helpers/parse-sms-template-values'
import { parseSmsSenderCode } from '@/modules/thinkzap/application/helpers/sms-sender-code'
import { resolveTemplateBody } from '@/modules/thinkzap/application/helpers/resolve-template-body'
import {
  findItemInContext,
  findLineWithEntitlement,
} from '@/modules/thinkzap/application/helpers/resolve-line-by-subscription-item'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { countTemplatePlaceholders } from '@/modules/thinkzap/application/helpers/count-template-placeholders'

/**
 * `POST /api/thinkzap/webhooks/bitrix/sms-provider` — o disparo da **campanha de SMS**
 * do Bitrix, um POST por destinatário.
 *
 * Três coisas o definem:
 *
 * 1. **A linha vem do `code`, e só dele.** O payload não carrega linha, app nem
 *    instalação; o `CODE` do sender deriva do id do item de assinatura, e essa
 *    derivação é o que reencontra a linha do lado de cá.
 * 2. **Nada é entregue aqui.** O handler grava a intenção no outbox e responde. Quem
 *    chama a Z-API ou a HubMessage é o worker, com retentativa, lock por destino,
 *    histórico e timeline. Campanha é o maior volume que o produto tem, chegando em
 *    rajada — entrega síncrona poria um `500` transitório do provider no caminho
 *    crítico de cada destinatário, sem retentativa.
 * 3. **Recusa de negócio responde `200` e reporta `failed`.** O `messageservice` tem
 *    canal próprio para dizer que deu errado — o status da mensagem —, e é ele que a
 *    tela de campanha lê. Um `5xx` produziria falha opaca no Bitrix **e** perderia o
 *    motivo, porque o `message_id` nunca receberia status.
 */
export class BitrixSmsProviderWebhookHandlerController extends Controller {
  constructor(
    private readonly getDomain: GetDomainRepository,
    private readonly getApp: GetInstalledAppRepository,
    private readonly getAplicationContext: GetAplicationContext,
    private readonly enqueueWidgetMessage: EnqueueWidgetMessageUseCase,
    private readonly enqueueTemplateSend: EnqueueTemplateSendService,
    private readonly listTemplates: ListWidgetTemplatesUseCase,
    private readonly outbox: PrismaWidgetOutboxRepository,
    private readonly bitrix: BitrixMethodCaller,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const data = req.body as BitrixSmsProviderWebhookRequest

    const senderCode = (data.code ?? '').trim()
    const messageId = String(data.message_id ?? '').trim()

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
     * O `code` que não deriva de nenhum id é sender **órfão** ou de outro app. `404`,
     * e o `code` recebido no log: é a única pista de qual provedor o cliente precisa
     * remover, e sem ela a campanha inteira falha sem explicação em lugar nenhum.
     */
    const parsed = parseSmsSenderCode(senderCode)
    if (!parsed) {
      logThinkzapError(apiLogger, 'thinkzap.bitrix.sms_sender_unknown', {
        app: 'thinkzap',
        source: 'bitrix',
        code: senderCode,
      })
      return this.notFound(new Error('Sender not found'))
    }

    const { subscriptionItemId } = parsed

    const scope = {
      subscriptionItemId,
      domainId: domain.id,
      appCode: app.appCodeId,
    }

    const context = await this.getAplicationContext.execute({
      domainId: domain.id,
      appCode: app.appCodeId,
    })

    let item: SubscriptionItem
    try {
      item = findItemInContext(context, subscriptionItemId)
    } catch (error) {
      if (!(error instanceof LineNotFoundError)) throw error

      logThinkzapError(apiLogger, 'thinkzap.bitrix.sms_sender_unknown', {
        app: 'thinkzap',
        source: 'bitrix',
        code: senderCode,
        subscriptionItemId,
      })
      return this.notFound(new Error('Sender not found'))
    }

    /**
     * Item que não é linha responde `422`, não `200` + `failed`: o sender **não
     * deveria existir**, e reportar recusa de negócio descreveria isso como um
     * problema da campanha, que é onde o cliente iria procurar.
     */
    if (item.metadata.provider === 'NONE') {
      logThinkzapError(apiLogger, 'thinkzap.bitrix.sms_sender_unknown', {
        app: 'thinkzap',
        source: 'bitrix',
        code: senderCode,
        subscriptionItemId,
        reason: 'not-a-line',
      })
      return {
        status: 422,
        result: { error: 'Subscription item is not a line' },
      }
    }

    /**
     * Habilitação **antes** do conteúdo: a assinatura vencida é a explicação mais
     * completa que existe para o cliente, e reportar "corpo inválido" numa linha que
     * não podia enviar de qualquer jeito mandaria ele consertar a coisa errada.
     */
    const { entitlement } = findLineWithEntitlement(
      context,
      subscriptionItemId,
      new Date(),
    )
    if (entitlement !== 'active') {
      return this.refuse(senderCode, messageId, 'line-not-entitled', {
        subscriptionItemId,
        entitlement,
      })
    }

    /**
     * Idempotência: retentativa do Bitrix e duplo disparo existem, e a segunda
     * mensagem é visível para o contato — no HubMessage, cobrada duas vezes. A
     * garantia real é o unique da coluna; esta leitura é o caminho feliz dela.
     */
    if (messageId) {
      const existing = await this.outbox.findBySmsMessageId(messageId)
      if (existing) {
        apiLogger.info(
          { app: 'thinkzap', source: 'bitrix', messageId },
          'sms campaign recipient already queued, skipping',
        )
        return this.ok({ received: true, queued: 0, duplicate: true })
      }
    }

    const body = data.message_body ?? ''
    const destination = data.message_to ?? ''

    /**
     * **O `CODE` decide o ramo, não o provider da linha.**
     *
     * Sender de template carrega qual template é; sender de linha carrega só a linha.
     * Ler o provider aqui daria a resposta certa por acidente hoje e a errada no dia
     * em que uma linha oficial tiver um sender de linha antigo — que é exatamente o
     * caso que a recusa abaixo cobre.
     */
    if (parsed.kind === 'template') {
      return this.dispatchTemplate({
        scope,
        senderCode,
        messageId,
        body,
        destination,
        templateName: parsed.templateName,
        language: parsed.language,
      })
    }

    /**
     * Sender **de linha** apontando para linha oficial: registro de antes de o
     * provedor por template existir.
     *
     * Recusa com motivo em vez de tentar adivinhar o template pelo corpo — o
     * `message_body` chega com os placeholders de CRM já resolvidos, e errar o
     * template numa campanha paga é caro demais para um heurístico. O admin remove o
     * sender antigo e o cliente registra por template.
     */
    if (item.metadata.provider === 'HUBMESSAGE') {
      return this.refuse(senderCode, messageId, 'line-sender-on-official', {
        subscriptionItemId,
      })
    }

    return this.dispatchText({
      scope,
      senderCode,
      messageId,
      body,
      destination,
    })
  }

  /**
   * Linha `ZAPI`: o corpo vai como texto livre, sem transformação.
   *
   * Sem template porque a Z-API não tem: quem escolhe o template é o `CODE` do sender,
   * e sender de template só existe para linha oficial.
   */
  private async dispatchText(input: DispatchInput): Promise<httpResponse> {
    const { scope, senderCode, messageId, body, destination } = input

    const text = body.trim()
    if (!text) {
      return this.refuse(senderCode, messageId, 'empty-body', {
        subscriptionItemId: scope.subscriptionItemId,
      })
    }

    try {
      await this.enqueueWidgetMessage.execute({
        ...scope,
        destination,
        message: text,
        entity: '',
        entityId: '',
        smsSenderCode: senderCode,
        smsMessageId: messageId,
      })
    } catch (error) {
      return this.refuse(senderCode, messageId, 'enqueue-refused', {
        subscriptionItemId: scope.subscriptionItemId,
        err: (error as Error).message,
      })
    }

    return this.accept(senderCode, messageId)
  }

  /**
   * Sender **de template**: o template vem do `CODE`, e o corpo traz só os valores.
   *
   * Campanha é outbound frio fora da janela de 24h — no WhatsApp Oficial isso só
   * existe com template aprovado. Como o `message_body` chega com os placeholders de
   * CRM já substituídos por valores reais, não sobra estrutura para inferir qual
   * template é; declará-lo no `CODE` é determinístico e transforma a lista de
   * provedores da campanha no **seletor de template**, que é onde o cliente já está
   * escolhendo.
   */
  private async dispatchTemplate(
    input: DispatchInput & { templateName: string; language: string },
  ): Promise<httpResponse> {
    const { scope, senderCode, messageId, body, destination } = input
    const { templateName, language } = input

    const bodyParameters = parseSmsTemplateValues(body)

    /**
     * `resolveTarget` recusa linha bloqueada, provider sem template e canal
     * desconectado — nessa ordem — sem gastar nenhuma chamada ao provider. É por isso
     * que o catálogo só é lido depois: numa linha desconectada não há catálogo.
     */
    let target
    try {
      target = await this.enqueueTemplateSend.resolveTarget(scope)
    } catch (error) {
      return this.refuse(senderCode, messageId, 'line-cannot-send-template', {
        subscriptionItemId: scope.subscriptionItemId,
        err: (error as Error).message,
      })
    }

    const templates = await this.listTemplates.execute(scope)
    const template = templates.find(
      candidate =>
        candidate.name === templateName && candidate.language === language,
    )

    if (!template) {
      return this.refuse(senderCode, messageId, 'template-not-in-catalog', {
        subscriptionItemId: scope.subscriptionItemId,
        templateName,
        language,
      })
    }

    /**
     * O corpo da campanha só carrega os valores das variáveis; não há como informar
     * o final de um link ou o código de um cupom. Enviar sem eles faria a Meta
     * recusar depois do aceite — e cobrar a tentativa como erro na campanha.
     */
    if (template.buttons.some(button => button.dynamic)) {
      return this.refuse(
        senderCode,
        messageId,
        'template-dynamic-button-unsupported',
        {
          subscriptionItemId: scope.subscriptionItemId,
          templateName,
          language,
        },
      )
    }

    /**
     * Mesmo caso do botão dinâmico: a Meta exige a imagem em todo envio, e a
     * campanha não tem onde informá-la.
     */
    if (template.header?.type === 'IMAGE') {
      return this.refuse(
        senderCode,
        messageId,
        'template-image-header-unsupported',
        {
          subscriptionItemId: scope.subscriptionItemId,
          templateName,
          language,
        },
        'thinkzap.template.image_header_not_supported',
      )
    }

    const expected = countTemplatePlaceholders(template.body)
    if (expected !== bodyParameters.length) {
      return this.refuse(senderCode, messageId, 'parameter-count-mismatch', {
        subscriptionItemId: scope.subscriptionItemId,
        templateName,
        expected,
        received: bodyParameters.length,
      })
    }

    try {
      await this.enqueueTemplateSend.enqueue(target, {
        ...scope,
        destination,
        templateName,
        language,
        bodyParameters,
        /**
         * O corpo registrado é o **renderizado**, como no widget e no robô: é o texto
         * que o histórico, a conversa do canal aberto e o aviso de falha mostram, e
         * nenhum dos três tem como substituir `{{1}}` depois.
         */
        templateBody: template.body,
        entity: '',
        entityId: '',
        smsSenderCode: senderCode,
        smsMessageId: messageId,
      })
    } catch (error) {
      return this.refuse(senderCode, messageId, 'enqueue-refused', {
        subscriptionItemId: scope.subscriptionItemId,
        err: (error as Error).message,
      })
    }

    apiLogger.info(
      {
        app: 'thinkzap',
        source: 'bitrix',
        subscriptionItemId: scope.subscriptionItemId,
        templateName,
        rendered: resolveTemplateBody(template.body, bodyParameters).length,
      },
      'sms campaign template recipient queued',
    )

    return this.accept(senderCode, messageId)
  }

  /** Aceito: `queued` no Bitrix, e o worker toma conta do resto. */
  private async accept(
    senderCode: string,
    messageId: string,
  ): Promise<httpResponse> {
    await this.reportStatus(senderCode, messageId, 'queued')

    return this.ok({ received: true, queued: 1 })
  }

  /**
   * Recusa de negócio: `200`, `failed` no Bitrix e o motivo no log.
   *
   * `200` porque o `messageservice` já tem canal para dizer que deu errado, e é ele
   * que a tela de campanha lê. Um `5xx` trocaria um motivo legível por uma falha
   * opaca — e o `message_id` nunca receberia status nenhum.
   */
  private async refuse(
    senderCode: string,
    messageId: string,
    reason: string,
    context: Record<string, unknown>,
    /** Código do log; o genérico da campanha, salvo recusa com runbook próprio. */
    errorCode: Parameters<
      typeof logThinkzapError
    >[1] = 'thinkzap.bitrix.sms_campaign_refused',
  ): Promise<httpResponse> {
    logThinkzapError(apiLogger, errorCode, {
      app: 'thinkzap',
      source: 'bitrix',
      code: senderCode,
      reason,
      ...context,
    })

    await this.reportStatus(senderCode, messageId, 'failed')

    return this.ok({ received: true, queued: 0, reason })
  }

  private async reportStatus(
    senderCode: string,
    messageId: string,
    status: 'queued' | 'failed',
  ): Promise<void> {
    if (!senderCode || !messageId) return

    await reportSmsMessageStatus(this.bitrix, { senderCode, messageId, status })
  }
}

type DispatchInput = {
  scope: { subscriptionItemId: string; domainId: string; appCode: string }
  senderCode: string
  messageId: string
  body: string
  destination: string
}

/**
 * O payload que o Bitrix entrega ao `HANDLER` de um sender de `messageservice`, **por
 * destinatário** da campanha.
 *
 * Não há campo de linha nem de template: `code` é o único identificador nosso que
 * volta, e `message_body` chega como texto com os placeholders de CRM já resolvidos.
 * As duas ausências são o que desenha o resto deste handler.
 */
export interface BitrixSmsProviderWebhookRequest {
  /** `CODE` do sender — a linha, derivada do id do item de assinatura. */
  code: string
  type: string
  /** Chave de idempotência e âncora do status de entrega. */
  message_id: string | number
  message_to: string
  message_body: string
  module_id?: string
  bindings?: unknown
  properties?: {
    phone_number?: string
    message_text?: string
  }
  ts?: string
  auth: {
    access_token: string
    domain: string
    member_id: string
    application_token?: string
    [key: string]: unknown
  }
}
