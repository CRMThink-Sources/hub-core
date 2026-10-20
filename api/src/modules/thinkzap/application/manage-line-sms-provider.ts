import { env } from '@/config/env'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import type { BitrixMethodCaller } from '@/shared/infra/clients/call-bitrix-idempotent'
import { LineProviderNotSupportedError } from '@/modules/thinkzap/domain/errors/line-provider-not-supported.error'
import { TemplateNotInCatalogError } from '@/modules/thinkzap/domain/errors/template-not-in-catalog.error'
import {
  deleteSmsSender,
  deleteSmsSenderByCode,
  type DeleteSmsSenderResult,
} from './delete-sms-sender'
import {
  ensureSmsSender,
  type EnsureSmsSenderResult,
} from './ensure-sms-sender'
import { countTemplatePlaceholders } from './helpers/count-template-placeholders'
import {
  toSmsSenderCode,
  toSmsTemplateSenderCode,
} from './helpers/sms-sender-code'
import { listSmsSenders } from './list-sms-senders.service'
import {
  assertConnectorLineEnabled,
  findConnectorLineWithEntitlement,
} from './helpers/resolve-line-by-subscription-item'

export type LineSmsProviderScope = {
  subscriptionItemId: string
  domainId: string
  appCode: string
}

export type LineSmsProviderReading = {
  registered: boolean
  /** `CODE` do sender desta linha — o mesmo que a campanha devolve no handler. */
  code: string
  /**
   * `false` quando `BITRIX_SMS_HANDLER_URL` está vazia neste ambiente.
   *
   * A tela usa para não oferecer um botão que só devolveria `skipped`: sem a rota
   * publicada, registrar poria na campanha do cliente um provedor apontando para
   * `404`, e é por isso que o registro é no-op — mas um botão que não faz nada e não
   * explica por quê é pior que um card ausente.
   */
  available: boolean
  /**
   * Risco de bloqueio do número pela Meta em disparo em massa. Só linha `ZAPI`.
   *
   * Vem do backend e não é derivado no front porque é ele que decide se a tela exige
   * ciência explícita antes de registrar.
   */
  banRisk: boolean
  /**
   * `true` na linha oficial: o provedor dela é **por template**, não por linha.
   *
   * A tela usa para apontar o cliente à aba de Templates em vez de oferecer um botão
   * que a escrita recusaria — no WhatsApp Oficial, campanha só sai com template
   * aprovado, e é o template que a lista de provedores do Bitrix precisa nomear.
   */
  perTemplate: boolean
}

/**
 * O provedor de mensagem de uma linha, na superfície do **cliente**.
 *
 * A leitura não recusa linha bloqueada — a aba abre e mostra o estado, como o resto
 * dos ajustes. Quem recusa é a escrita.
 */
export class GetLineSmsProvider {
  constructor(private readonly getAplicationContext: GetAplicationContext) {}

  async execute(
    scope: LineSmsProviderScope,
    client: BitrixMethodCaller,
  ): Promise<LineSmsProviderReading> {
    const context = await this.getAplicationContext.execute({
      domainId: scope.domainId,
      appCode: scope.appCode,
    })

    const { item } = findConnectorLineWithEntitlement(
      context,
      scope.subscriptionItemId,
      new Date(),
    )

    const code = toSmsSenderCode(item.id)
    const available = Boolean(env.bitrix.smsSender.handlerUrl)

    /**
     * Sem handler não há registro possível, e a listagem custaria uma chamada ao
     * Bitrix para responder o que já se sabe.
     */
    if (!available) {
      return {
        registered: false,
        code,
        available,
        banRisk: item.metadata.provider === 'ZAPI',
        perTemplate: item.metadata.provider === 'HUBMESSAGE',
      }
    }

    const senders = await listSmsSenders(client, [item])

    return {
      registered: senders.some(sender => sender.code === code),
      code,
      available,
      banRisk: item.metadata.provider === 'ZAPI',
      perTemplate: item.metadata.provider === 'HUBMESSAGE',
    }
  }
}

export type TemplateProviderReading = {
  templateName: string
  language: string
  /** Corpo aprovado, com os placeholders intactos — a tela monta o exemplo dele. */
  body: string
  /** Quantos valores o corpo da campanha precisa trazer. */
  parameterCount: number
  /**
   * Template com link dinâmico ou copiar código: a campanha não tem como informar
   * esses valores e o envio é recusado, então a tela não o oferece.
   */
  hasDynamicButton: boolean
  /**
   * Template com imagem no cabeçalho: a Meta exige a imagem em todo envio, e a
   * campanha não tem onde informá-la — mesmo tratamento do botão dinâmico.
   */
  hasImageHeader: boolean
  registered: boolean
  code: string
}

export type LineTemplateProvidersReading = {
  /** `false` sem `BITRIX_SMS_HANDLER_URL`: registrar seria no-op. */
  available: boolean
  templates: TemplateProviderReading[]
}

/**
 * Os templates aprovados da linha oficial, cada um com o estado do provedor.
 *
 * **Um sender por template**, e não um por linha: o payload que o Bitrix entrega ao
 * handler não carrega template nenhum, e o corpo chega com os placeholders de CRM já
 * resolvidos. Declarar o template no `CODE` é o que sobra — e tem o efeito de
 * transformar a lista de provedores da campanha no seletor de template, que é onde o
 * cliente já está escolhendo.
 *
 * O opt-in é por template porque é ele que controla o tamanho da lista no Bitrix:
 * registrar o catálogo inteiro multiplicaria os provedores do cliente pelo número de
 * templates aprovados, e a maioria nunca vira campanha.
 */
export class GetLineTemplateProviders {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly listTemplates: ListTemplatesForLine,
  ) {}

  async execute(
    scope: LineSmsProviderScope,
    client: BitrixMethodCaller,
  ): Promise<LineTemplateProvidersReading> {
    const context = await this.getAplicationContext.execute({
      domainId: scope.domainId,
      appCode: scope.appCode,
    })

    const { item } = findConnectorLineWithEntitlement(
      context,
      scope.subscriptionItemId,
      new Date(),
    )

    if (item.metadata.provider !== 'HUBMESSAGE') {
      throw new LineProviderNotSupportedError(item.metadata.provider)
    }

    const available = Boolean(env.bitrix.smsSender.handlerUrl)
    const templates = await this.listTemplates.execute(scope)

    /**
     * Sem handler não há registro possível, e a listagem de senders custaria uma
     * chamada ao Bitrix para responder o que já se sabe. O catálogo continua sendo
     * lido: a tela mostra os templates, só não oferece a ação.
     */
    const registeredCodes = available
      ? new Set((await listSmsSenders(client, [item])).map(s => s.code))
      : new Set<string>()

    return {
      available,
      templates: templates.map(template => {
        const code = toSmsTemplateSenderCode(
          item.id,
          template.name,
          template.language,
        )

        return {
          templateName: template.name,
          language: template.language,
          body: template.body,
          parameterCount: countTemplatePlaceholders(template.body),
          hasDynamicButton: (template.buttons ?? []).some(b => b.dynamic),
          hasImageHeader: template.header?.type === 'IMAGE',
          registered: registeredCodes.has(code),
          code,
        }
      }),
    }
  }
}

/** O mínimo da listagem de templates que este caso de uso usa. */
export type ListTemplatesForLine = {
  execute(input: LineSmsProviderScope): Promise<
    {
      name: string
      language: string
      body: string
      buttons?: { dynamic: boolean }[]
      header?: { type: string }
    }[]
  >
}

/**
 * Registra **um template** da linha oficial como provedor da campanha.
 *
 * Recusa template que não está no catálogo aprovado da linha: o sender existiria na
 * campanha do cliente e todo destinatário morreria no envio, que é a falha mais cara
 * possível — a mensagem do WhatsApp Oficial é cobrada.
 */
export class RegisterTemplateSmsProvider {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly listTemplates: ListTemplatesForLine,
  ) {}

  async execute(
    scope: LineSmsProviderScope,
    input: { templateName: string; language: string },
    client: BitrixMethodCaller,
  ): Promise<{ result: EnsureSmsSenderResult }> {
    const context = await this.getAplicationContext.execute({
      domainId: scope.domainId,
      appCode: scope.appCode,
    })

    const item = assertConnectorLineEnabled(
      context,
      scope.subscriptionItemId,
      new Date(),
    )

    if (item.metadata.provider !== 'HUBMESSAGE') {
      throw new LineProviderNotSupportedError(item.metadata.provider)
    }

    const templates = await this.listTemplates.execute(scope)
    const template = templates.find(
      candidate =>
        candidate.name === input.templateName &&
        candidate.language === input.language,
    )

    if (!template) {
      throw new TemplateNotInCatalogError(input.templateName, input.language)
    }

    return {
      result: await ensureSmsSender(client, {
        item,
        template: {
          name: template.name,
          language: template.language,
          parameterCount: countTemplatePlaceholders(template.body),
        },
      }),
    }
  }
}

/**
 * Remove o provedor de um template.
 *
 * Não confere o catálogo: remover um sender de template que a Meta reprovou depois é
 * exatamente o que o cliente precisa poder fazer, e exigir que ele ainda exista lá
 * deixaria o provedor preso na campanha.
 */
export class DeleteTemplateSmsProvider {
  constructor(private readonly getAplicationContext: GetAplicationContext) {}

  async execute(
    scope: LineSmsProviderScope,
    input: { templateName: string; language: string },
    client: BitrixMethodCaller,
  ): Promise<{ result: DeleteSmsSenderResult }> {
    const context = await this.getAplicationContext.execute({
      domainId: scope.domainId,
      appCode: scope.appCode,
    })

    const item = assertConnectorLineEnabled(
      context,
      scope.subscriptionItemId,
      new Date(),
    )

    return {
      result: await deleteSmsSenderByCode(
        client,
        toSmsTemplateSenderCode(item.id, input.templateName, input.language),
      ),
    }
  }
}

/**
 * Registra o provedor da linha a pedido do **cliente**.
 *
 * Recusa linha bloqueada, ao contrário da ação equivalente do portal admin: suporte
 * atua na linha travada de propósito, o cliente não. E registrar numa linha sem
 * habilitação criaria na campanha dele um provedor que recusa **todo** destinatário,
 * o que é pior que não oferecer o botão.
 */
export class RegisterLineSmsProvider {
  constructor(private readonly getAplicationContext: GetAplicationContext) {}

  async execute(
    scope: LineSmsProviderScope,
    client: BitrixMethodCaller,
  ): Promise<{ result: EnsureSmsSenderResult }> {
    const context = await this.getAplicationContext.execute({
      domainId: scope.domainId,
      appCode: scope.appCode,
    })

    const item = assertConnectorLineEnabled(
      context,
      scope.subscriptionItemId,
      new Date(),
    )

    /**
     * Linha oficial não tem sender de linha: campanha por WhatsApp Oficial é outbound
     * frio, e isso só existe com template aprovado. Um sender de linha aqui aceitaria
     * a campanha e recusaria cada destinatário no handler — falha por contato, com o
     * cliente descobrindo no meio do disparo.
     */
    if (item.metadata.provider === 'HUBMESSAGE') {
      throw new LineProviderNotSupportedError(item.metadata.provider)
    }

    return { result: await ensureSmsSender(client, { item }) }
  }
}

/**
 * Remove o provedor da linha a pedido do cliente.
 *
 * Mesma recusa por bloqueio do registro — não por simetria, mas porque a rota é de
 * escrita no portal dele, e linha sem habilitação não opera por nenhum caminho do
 * tenant. Sender de linha que perdeu habilitação continua removível pelo portal admin.
 */
export class DeleteLineSmsProvider {
  constructor(private readonly getAplicationContext: GetAplicationContext) {}

  async execute(
    scope: LineSmsProviderScope,
    client: BitrixMethodCaller,
  ): Promise<{ result: DeleteSmsSenderResult }> {
    const context = await this.getAplicationContext.execute({
      domainId: scope.domainId,
      appCode: scope.appCode,
    })

    const item = assertConnectorLineEnabled(
      context,
      scope.subscriptionItemId,
      new Date(),
    )

    return { result: await deleteSmsSender(client, item.id) }
  }
}
