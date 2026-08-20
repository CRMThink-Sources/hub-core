import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { TemplatesNotSupportedError } from '@/modules/thinkzap/domain/ports/template-errors'
import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import { WhatsAppTemplateProvider } from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'

type ProviderMap = Partial<Record<ConnectorProvider, WhatsAppTemplateProvider>>

/**
 * Resolver baseado em mapa `ConnectorProvider` → adapter de templates. Falha
 * explicitamente quando o provider não está registrado (ex.: HubMessage sem
 * configuração de ambiente).
 */
export class MapTemplateProviderResolver implements TemplateProviderResolver {
  constructor(private readonly providers: ProviderMap) {}

  resolve(provider: ConnectorProvider): WhatsAppTemplateProvider {
    const adapter = this.providers[provider]
    if (!adapter) {
      throw new TemplatesNotSupportedError(provider)
    }
    return adapter
  }
}
