import { env } from '@/config/env'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { TemplateProviderResolver } from '@/modules/thinkzap/domain/ports/template-provider-resolver.port'
import { WhatsAppTemplateProvider } from '@/modules/thinkzap/domain/ports/whatsapp-template-provider.port'
import { HubMessageClient } from '../../infra/clients/hubmessage.client'
import { HubMessageTemplateProvider } from '../../infra/providers/hubmessage-template-provider'
import { MapTemplateProviderResolver } from '../../infra/providers/map-template-provider-resolver'
import { ZApiTemplateProvider } from '../../infra/providers/zapi-template-provider'

/**
 * Monta o resolver de providers de templates. O adapter HubMessage só é
 * registrado quando há configuração (`HUBMESSAGE_SECRET_KEY`); Z-API é sempre
 * registrado como *unsupported* (lança erro tipado se acionado).
 */
export function makeTemplateProviderResolver(): TemplateProviderResolver {
  const providers: Partial<
    Record<ConnectorProvider, WhatsAppTemplateProvider>
  > = {
    [ConnectorProvider.ZAPI]: new ZApiTemplateProvider(),
  }

  if (env.hubMessage.secretKey) {
    const client = new HubMessageClient({
      baseUrl: env.hubMessage.baseUrl,
      token: env.hubMessage.secretKey,
    })
    providers[ConnectorProvider.HUBMESSAGE] = new HubMessageTemplateProvider(
      client,
    )
  }

  return new MapTemplateProviderResolver(providers)
}
