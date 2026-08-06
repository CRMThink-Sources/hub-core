import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { TemplateMessageSender } from './template-message-sender.port'

/**
 * Identificadores necessários para enviar um template, neutros entre providers.
 * Cada adapter consome só o que lhe cabe — HubMessage usa os dois.
 */
export type TemplateSendTargetRef = {
  /** Canal da linha no provider (`metadata.hubmessageChannelId`). */
  channelId: string
  /**
   * Telefone do destinatário, **já normalizado** pelo chamador.
   *
   * Diferente do envio livre disparado pelo Bitrix, aqui o número vem do destino
   * escolhido no widget (a lista de `/thinkzap/destinations`), não do `chat.id` de
   * um evento — não há conversa previamente aberta a casar.
   */
  recipientIdentifier: string
}

/**
 * Resolve o adapter de envio de template a partir do provider da linha. Provider
 * sem suporte SHALL falhar explicitamente, **sem executar nenhuma chamada
 * remota**.
 */
export interface TemplateMessageSenderResolver {
  resolve(
    provider: ConnectorProvider,
    target: TemplateSendTargetRef,
  ): TemplateMessageSender
}
