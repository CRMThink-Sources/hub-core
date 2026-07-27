import { env } from '@/config/env'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { OutboundMessageSender } from '@/modules/thinkzap/domain/ports/outbound-message-sender.port'
import {
  OutboundSenderResolver,
  OutboundTargetRef,
} from '@/modules/thinkzap/domain/ports/outbound-sender-resolver.port'
import { HubMessageOutboundSender } from '../infra/adapters/hubmessage-outbound-sender.adapter'
import { ZApiOutboundSender } from '../infra/adapters/z-api-outbound-sender.adapter'
import { HubMessageClient } from '../infra/clients/hubmessage.client'
import { ZApiClient } from '../infra/clients/z-api.client'

/**
 * Resolve o adapter de envio a partir do provider do conector. Espelha
 * `make-connector-provider-resolver.ts`, mas os senders carregam config por
 * mensagem (instância/token/telefone vs. canal/destinatário), por isso o
 * `target` entra na resolução em vez de no construtor.
 */
export class DefaultOutboundSenderResolver implements OutboundSenderResolver {
  resolve(
    provider: ConnectorProvider,
    target: OutboundTargetRef,
  ): OutboundMessageSender {
    switch (provider) {
      case ConnectorProvider.ZAPI:
        return new ZApiOutboundSender(
          new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken),
          {
            instanceId: target.instanceId,
            instanceToken: target.zApiToken ?? '',
            phone: target.chatId,
          },
        )

      case ConnectorProvider.HUBMESSAGE: {
        if (!env.hubMessage.secretKey) {
          throw new Error(
            'HubMessage: token de autenticação ausente na configuração',
          )
        }

        // Mesmo fallback do adapter de ciclo de vida: o provisionamento grava o
        // channelId nos dois campos, mas conectores antigos podem ter só um.
        const channelId = target.channelId ?? target.instanceId
        if (!channelId) {
          throw new Error('Conector HubMessage sem channelId')
        }

        return new HubMessageOutboundSender(
          new HubMessageClient({
            baseUrl: env.hubMessage.baseUrl,
            token: env.hubMessage.secretKey,
          }),
          { channelId, recipientIdentifier: target.chatId },
        )
      }

      default:
        throw new Error(`Provider de envio não suportado: ${String(provider)}`)
    }
  }
}

export function makeOutboundSenderResolver(): OutboundSenderResolver {
  return new DefaultOutboundSenderResolver()
}
