import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { WhatsAppConnectorProvider } from './whatsapp-connector-provider.port'

/** Resolve a implementação concreta de provider a partir do tipo do conector. */
export interface ConnectorProviderResolver {
  resolve(provider: ConnectorProvider): WhatsAppConnectorProvider
}
