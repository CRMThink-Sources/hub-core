import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ConnectorNotTemplateCapableError } from '@/modules/thinkzap/domain/ports/template-errors'
import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import { WhatsAppTemplateProvider } from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import { findItemInContext } from './resolve-line-by-subscription-item'

export type TemplateContext = {
  wabaId: string
  provider: WhatsAppTemplateProvider
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
 */
export async function resolveTemplateContext(
  input: ResolveTemplateContextInput,
  deps: {
    getAplicationContext: GetAplicationContext
    templateProviderResolver: TemplateProviderResolver
  },
): Promise<TemplateContext> {
  const context = await deps.getAplicationContext.execute({
    domainId: input.domainId,
    appCode: input.appCode,
  })

  // `findItemInContext` lança `LineNotFoundError` para item fora da instalação: o
  // escopo continua saindo do JWT.
  const item = findItemInContext(context, input.subscriptionItemId)

  if (item.metadata.provider !== 'HUBMESSAGE') {
    throw new ConnectorNotTemplateCapableError(input.subscriptionItemId)
  }

  return {
    wabaId: item.metadata.wabaId,
    provider: deps.templateProviderResolver.resolve(
      ConnectorProvider.HUBMESSAGE,
    ),
  }
}
