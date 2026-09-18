import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { InteractiveButtonSender } from './interactive-button-sender.port'

/**
 * Identificadores necessários para enviar botões, neutros entre providers.
 * Cada adapter consome só o que lhe cabe — mirror de `TemplateSendTargetRef`.
 */
export type InteractiveButtonSendTargetRef = {
  /** Canal da linha no provider (`metadata.hubmessageChannelId`). Usado só pelo adapter HubMessage. */
  channelId?: string
  /** `instanceId`/`instanceToken` da linha no provider. Usados só pelo adapter Z-API. */
  instanceId?: string
  instanceToken?: string
  /** Telefone do destinatário, **já normalizado** pelo chamador. */
  recipientIdentifier: string
}

/**
 * Resolve o adapter de envio de botões a partir do provider da linha.
 *
 * Ao contrário de `TemplateMessageSenderResolver`, os dois providers têm
 * adapter real — o caminho de "não suportado" só existe como defesa contra
 * ambiente mal configurado (ex.: HubMessage sem `HUBMESSAGE_SECRET_KEY`).
 */
export interface InteractiveButtonSenderResolver {
  resolve(
    provider: ConnectorProvider,
    target: InteractiveButtonSendTargetRef,
  ): InteractiveButtonSender
}
