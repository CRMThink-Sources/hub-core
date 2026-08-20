import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import { WhatsAppConnectorProvider } from '@/modules/thinkzap/domain/ports/whatsapp-connector-provider.port'

type ProviderMap = Partial<Record<ConnectorProvider, WhatsAppConnectorProvider>>

/**
 * Resolver baseado em mapa `ConnectorProvider` → adapter. Falha explicitamente
 * (sem executar operações remotas) quando o provider não está registrado.
 */
export class MapConnectorProviderResolver implements ConnectorProviderResolver {
  constructor(private readonly providers: ProviderMap) {}

  resolve(provider: ConnectorProvider): WhatsAppConnectorProvider {
    const adapter = this.providers[provider]
    if (!adapter) {
      throw new Error(`Provider de conector não suportado: ${provider}`)
    }
    return adapter
  }
}
