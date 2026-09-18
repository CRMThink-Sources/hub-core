import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import {
  ButtonAction,
  InteractiveButtonDescriptor,
  InteractiveButtonSendResult,
  InteractiveButtonSender,
} from '@/modules/thinkzap/domain/ports/interactive-button-sender.port'
import { assertValidButtonsForProvider } from '@/modules/thinkzap/domain/ports/interactive-button-validation'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { ZApiButtonAction } from '@/modules/thinkzap/infra/clients/types/z-api.types'

export type ZApiInteractiveButtonSenderConfig = {
  instanceId: string
  instanceToken: string
  /** Telefone do destinatário, já normalizado pelo chamador. */
  phone: string
}

/**
 * Adapter Z-API do contrato `InteractiveButtonSender`.
 *
 * `assertValidButtonsForProvider` roda aqui como defesa — o enfileiramento já
 * faz o mesmo pré-check antes de gravar a intenção — para que este adapter
 * nunca dependa de o chamador ter validado antes. O WhatsApp Web rejeita
 * misturar botão `REPLY` com `CALL`/`URL` no mesmo envio; `CALL` e `URL` entre
 * si podem conviver.
 */
export class ZApiInteractiveButtonSender implements InteractiveButtonSender {
  constructor(
    private readonly client: ZApiClient,
    private readonly config: ZApiInteractiveButtonSenderConfig,
  ) {}

  async send(
    descriptor: InteractiveButtonDescriptor,
  ): Promise<InteractiveButtonSendResult> {
    assertValidButtonsForProvider(ConnectorProvider.ZAPI, descriptor.buttons)

    const { instanceId, instanceToken, phone } = this.config

    const result = await this.client.sendButtonActions(
      instanceId,
      instanceToken,
      {
        phone,
        message: descriptor.body,
        ...(descriptor.header ? { title: descriptor.header } : {}),
        ...(descriptor.footer ? { footer: descriptor.footer } : {}),
        buttonActions: descriptor.buttons.map(toZApiButtonAction),
      },
    )

    return { messageId: result.messageId }
  }
}

function toZApiButtonAction(button: ButtonAction): ZApiButtonAction {
  return {
    id: button.id,
    type: button.type,
    label: button.label,
    ...(button.type === 'URL' ? { url: button.url } : {}),
    ...(button.type === 'CALL' ? { phone: button.phone } : {}),
  }
}
