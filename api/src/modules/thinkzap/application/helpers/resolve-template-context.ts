import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ConnectorNotTemplateCapableError } from '@/modules/thinkzap/domain/ports/template-errors'
import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import { WhatsAppTemplateProvider } from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'

/** Erro quando o conector informado não existe. */
export class ConnectorNotFoundError extends Error {
  constructor(connectorId: string) {
    super(`Conector "${connectorId}" não encontrado`)
    this.name = 'ConnectorNotFoundError'
  }
}

export type TemplateContext = {
  wabaId: string
  provider: WhatsAppTemplateProvider
}

/**
 * Resolve o contexto necessário para operar templates de um conector: carrega o
 * conector e a `Instance`, extrai o `wabaId` e resolve o provider de templates.
 * Falha explicitamente quando o conector não existe ou não possui WABA.
 */
export async function resolveTemplateContext(
  connectorId: string,
  deps: {
    getConnectorRepository: GetConnectorRepository
    getInstanceRepository: GetInstanceRepository
    templateProviderResolver: TemplateProviderResolver
  },
): Promise<TemplateContext> {
  const connector = await deps.getConnectorRepository.get(connectorId)
  if (!connector) {
    throw new ConnectorNotFoundError(connectorId)
  }

  const instance = await deps.getInstanceRepository.getInstance(
    connector.instanceId,
  )
  if (!instance?.wabaId) {
    throw new ConnectorNotTemplateCapableError(connectorId)
  }

  const provider = deps.templateProviderResolver.resolve(
    connector.provider ?? ConnectorProvider.ZAPI,
  )

  return { wabaId: instance.wabaId, provider }
}
