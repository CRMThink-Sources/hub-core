import { env } from '@/config/env'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { TemplateMessageSenderResolver } from '@/modules/thinkzap/domain/ports/template-sender-resolver.port'
import { HubMessageTemplateSender } from '../../infra/adapters/hubmessage-template-sender.adapter'
import { UnsupportedTemplateSender } from '../../infra/adapters/unsupported-template-sender.adapter'
import { HubMessageClient } from '../../infra/clients/hubmessage.client'
import {
  MapTemplateSenderResolver,
  TemplateSenderFactory,
} from '../../infra/providers/map-template-sender-resolver'

/**
 * Monta o resolver de envio de template. Espelha
 * `make-template-provider-resolver.ts`: o adapter HubMessage só é registrado
 * quando há configuração (`HUBMESSAGE_SECRET_KEY`), e Z-API é sempre registrado
 * como *unsupported* — acionado, lança erro tipado sem tocar rede.
 */
export function makeTemplateSenderResolver(): TemplateMessageSenderResolver {
  const factories: Partial<Record<ConnectorProvider, TemplateSenderFactory>> = {
    [ConnectorProvider.ZAPI]: () => new UnsupportedTemplateSender('ZAPI'),
  }

  if (env.hubMessage.secretKey) {
    const token = env.hubMessage.secretKey
    factories[ConnectorProvider.HUBMESSAGE] = target =>
      new HubMessageTemplateSender(
        new HubMessageClient({ baseUrl: env.hubMessage.baseUrl, token }),
        {
          channelId: target.channelId,
          recipientIdentifier: target.recipientIdentifier,
        },
      )
  }

  return new MapTemplateSenderResolver(factories)
}
