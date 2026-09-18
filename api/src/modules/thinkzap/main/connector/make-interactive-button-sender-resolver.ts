import { env } from '@/config/env'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { InteractiveButtonSenderResolver } from '@/modules/thinkzap/domain/ports/interactive-button-sender-resolver.port'
import { HubMessageInteractiveButtonSender } from '../../infra/adapters/hubmessage-interactive-button-sender.adapter'
import { ZApiInteractiveButtonSender } from '../../infra/adapters/z-api-interactive-button-sender.adapter'
import { HubMessageClient } from '../../infra/clients/hubmessage.client'
import { ZApiClient } from '../../infra/clients/z-api.client'
import {
  InteractiveButtonSenderFactory,
  MapInteractiveButtonSenderResolver,
} from '../../infra/providers/map-interactive-button-sender-resolver'

/**
 * Monta o resolver de envio de botões. Ao contrário de
 * `makeTemplateSenderResolver`, Z-API é sempre um adapter real (não
 * *unsupported*) — os dois providers suportam o recurso. HubMessage só é
 * registrado quando há configuração (`HUBMESSAGE_SECRET_KEY`), mesmo padrão
 * do resolver de template.
 */
export function makeInteractiveButtonSenderResolver(): InteractiveButtonSenderResolver {
  const factories: Partial<
    Record<ConnectorProvider, InteractiveButtonSenderFactory>
  > = {
    [ConnectorProvider.ZAPI]: target =>
      new ZApiInteractiveButtonSender(
        new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken),
        {
          instanceId: target.instanceId ?? '',
          instanceToken: target.instanceToken ?? '',
          phone: target.recipientIdentifier,
        },
      ),
  }

  if (env.hubMessage.secretKey) {
    const token = env.hubMessage.secretKey
    factories[ConnectorProvider.HUBMESSAGE] = target =>
      new HubMessageInteractiveButtonSender(
        new HubMessageClient({ baseUrl: env.hubMessage.baseUrl, token }),
        {
          channelId: target.channelId ?? '',
          recipientIdentifier: target.recipientIdentifier,
        },
      )
  }

  return new MapInteractiveButtonSenderResolver(factories)
}
