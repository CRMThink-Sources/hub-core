import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { OutboundMessageSender } from './outbound-message-sender.port'

/**
 * Identificadores necessários para enviar ao contato, neutros entre providers.
 * Cada adapter consome só o que lhe cabe: Z-API usa `instanceId`/`zApiToken`,
 * HubMessage usa `channelId`.
 */
export type OutboundTargetRef = {
  instanceId: string
  zApiToken?: string | null
  channelId?: string | null
  /** Telefone do contato — `chat.id` do evento do Bitrix. */
  chatId: string
}

/**
 * Resolve o adapter de envio concreto a partir do provider do conector.
 * Provider não suportado SHALL falhar explicitamente, sem executar nenhuma
 * chamada remota de envio.
 */
export interface OutboundSenderResolver {
  resolve(
    provider: ConnectorProvider,
    target: OutboundTargetRef,
  ): OutboundMessageSender
}
