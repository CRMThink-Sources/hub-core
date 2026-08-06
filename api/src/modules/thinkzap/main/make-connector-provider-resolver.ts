import { env } from '@/config/env'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import { WhatsAppConnectorProvider } from '@/modules/thinkzap/domain/ports/whatsapp-connector-provider.port'
import { CreateInstanceGateway } from '@/modules/thinkzap/domain/repositories/create-instance.gateway'
import { UpdateInstanceGateway } from '@/modules/thinkzap/domain/repositories/update-instance.gateway'
import { ZApiClient } from '../infra/clients/z-api.client'
import { HubMessageClient } from '../infra/clients/hubmessage.client'
import { ZApiConnectorProvider } from '../infra/providers/zapi-connector-provider'
import { HubMessageConnectorProvider } from '../infra/providers/hubmessage-connector-provider'
import { MapConnectorProviderResolver } from '../infra/providers/map-connector-provider-resolver'

type Deps = {
  zApiClient: ZApiClient
  instanceGateway: CreateInstanceGateway & UpdateInstanceGateway
}

/**
 * Monta o resolver de providers. O adapter HubMessage só é registrado quando
 * há configuração (`HUBMESSAGE_SECRET_KEY`); sem isso, tentar provisionar
 * HubMessage falha explicitamente no resolver.
 */
export function makeConnectorProviderResolver(
  deps: Deps,
): ConnectorProviderResolver {
  const providers: Partial<
    Record<ConnectorProvider, WhatsAppConnectorProvider>
  > = {
    [ConnectorProvider.ZAPI]: new ZApiConnectorProvider(
      deps.instanceGateway,
      deps.zApiClient,
    ),
  }

  if (env.hubMessage.secretKey) {
    const client = new HubMessageClient({
      baseUrl: env.hubMessage.baseUrl,
      token: env.hubMessage.secretKey,
    })
    providers[ConnectorProvider.HUBMESSAGE] = new HubMessageConnectorProvider(
      client,
      { webhookUrl: env.hubMessage.webhookUrl },
    )
  }

  return new MapConnectorProviderResolver(providers)
}
