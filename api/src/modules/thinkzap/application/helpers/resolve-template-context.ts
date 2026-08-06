import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import {
  ChannelNotConnectedError,
  ConnectorNotTemplateCapableError,
} from '@/modules/thinkzap/domain/ports/template-errors'
import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import { WhatsAppTemplateProvider } from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import {
  assertLineEnabled,
  findItemInContext,
} from './resolve-line-by-subscription-item'

export type TemplateContext = {
  wabaId: string
  provider: WhatsAppTemplateProvider
}

/**
 * A linha apta a operar templates, **sem** provider resolvido.
 *
 * O `item` vem junto porque quem envia precisa do `hubmessageChannelId`, que só o
 * item carrega — `wabaId` identifica a conta, não o canal por onde a mensagem sai.
 */
export type TemplateLine = {
  item: SubscriptionItem
  wabaId: string
}

export type ResolveTemplateContextInput = {
  /** Id do item de assinatura — a linha. */
  subscriptionItemId: string
  domainId: string
  appCode: string
}

/**
 * Resolve o que é preciso para operar templates de uma linha.
 *
 * O `wabaId` vive no `metadata` do item HubMessage, então nem `Connector` nem
 * `Instance` participam: a linha é o item, e o item já carrega a identidade da
 * conta WhatsApp Business.
 *
 * Template é recurso só do WhatsApp Oficial — linha Z-API não tem WABA, e cair
 * aqui com uma é erro de capacidade, não de autorização.
 *
 * `requireEnabled` é o que separa as duas metades desta superfície: cadastrar e
 * sincronizar são escrita no provider e recusam linha bloqueada; **listar
 * continua permitido**, porque é leitura e a tela precisa mostrar o que o cliente
 * tinha. Por isso a habilitação é parâmetro e não decisão de dentro.
 */
export async function resolveTemplateContext(
  input: ResolveTemplateContextInput,
  deps: {
    getAplicationContext: GetAplicationContext
    templateProviderResolver: TemplateProviderResolver
  },
  options: { requireEnabled?: boolean; now?: Date } = {},
): Promise<TemplateContext> {
  const { wabaId } = await resolveTemplateLine(input, deps, options)

  return {
    wabaId,
    provider: deps.templateProviderResolver.resolve(
      ConnectorProvider.HUBMESSAGE,
    ),
  }
}

/**
 * A metade de leitura de `resolveTemplateContext`: acha a linha, valida
 * habilitação (quando pedida), provider e canal conectado — e para aí.
 *
 * Extraído porque **enviar** template não usa `WhatsAppTemplateProvider`: aquele é
 * o catálogo por WABA, e o envio resolve outro contrato
 * (`TemplateMessageSender`, por canal + destinatário). Chamar
 * `resolveTemplateContext` só para reaproveitar as validações resolveria um provider
 * que o envio descarta — e, sem configuração de ambiente, recusaria com
 * `TemplatesNotSupportedError` ("não suporta gestão de templates"), texto errado
 * para quem só está tentando mandar mensagem.
 *
 * A ordem das recusas é a mesma para os dois consumidores, e é o que a spec exige:
 * escopo → habilitação → capacidade de provider → canal conectado.
 */
export async function resolveTemplateLine(
  input: ResolveTemplateContextInput,
  deps: { getAplicationContext: GetAplicationContext },
  options: { requireEnabled?: boolean; now?: Date } = {},
): Promise<TemplateLine> {
  const context = await deps.getAplicationContext.execute({
    domainId: input.domainId,
    appCode: input.appCode,
  })

  // `findItemInContext` lança `LineNotFoundError` para item fora da instalação: o
  // escopo continua saindo do JWT.
  const item = findItemInContext(context, input.subscriptionItemId)

  if (options.requireEnabled === true) {
    assertLineEnabled(
      context,
      input.subscriptionItemId,
      options.now ?? new Date(),
    )
  }

  if (item.metadata.provider !== 'HUBMESSAGE') {
    throw new ConnectorNotTemplateCapableError(input.subscriptionItemId)
  }

  /**
   * Canal criado e número ainda não conectado: a WABA não existe até o embedded
   * signup, então a linha é do provider certo e mesmo assim não tem o que consultar.
   *
   * Erro próprio, e não `ConnectorNotTemplateCapableError`: aquele diz "esta linha
   * nunca vai ter templates", e este diz "ainda não" — a ação do cliente é concluir a
   * conexão.
   */
  if (!item.metadata.wabaId) {
    throw new ChannelNotConnectedError(input.subscriptionItemId)
  }

  return { item, wabaId: item.metadata.wabaId }
}
