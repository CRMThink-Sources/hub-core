import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { WhatsAppTemplateProvider } from './whatsapp-template-provider.port'

/** Resolve a implementação de provider de templates a partir do tipo do conector. */
export interface TemplateProviderResolver {
  resolve(provider: ConnectorProvider): WhatsAppTemplateProvider
}
