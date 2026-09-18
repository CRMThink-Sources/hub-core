import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ButtonProviderUnavailableError } from '@/modules/thinkzap/domain/ports/button-errors'
import {
  ButtonAction,
  InteractiveButtonDescriptor,
  InteractiveButtonSendResult,
  InteractiveButtonSender,
} from '@/modules/thinkzap/domain/ports/interactive-button-sender.port'
import { assertValidButtonsForProvider } from '@/modules/thinkzap/domain/ports/interactive-button-validation'
import { isProviderUnavailableError } from './is-provider-unavailable-error'
import { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import {
  HubMessageButtonAction,
  HubMessageQuickReplyButtonAction,
  SendHubMessageInteractiveActionParams,
  SendHubMessageInteractiveButtonParams,
} from '@/modules/thinkzap/infra/clients/types/hubmessage.types'
import { createWorkerSourceLogger } from '@/shared/infra/logger'

const log = createWorkerSourceLogger('hubmessage')

export type HubMessageInteractiveButtonSenderConfig = {
  /** Canal da linha no provider (`metadata.hubmessageChannelId`). */
  channelId: string
  /** Telefone do destinatário, já normalizado pelo chamador. */
  recipientIdentifier: string
}

/**
 * Adapter HubMessage do contrato `InteractiveButtonSender`.
 *
 * `URL` (até 1) e `REPLY` (até 3) vão por rotas **diferentes** da HubMessage
 * — `INTERACTIVE_ACTION` e `INTERACTIVE_BUTTON`, não o mesmo corpo com outro
 * `content.type` cosmético; `REPLY` não tem `header`/`footer`. `CALL` não
 * existe em mensagem de sessão livre da Cloud API da Meta por trás (só
 * template aprovado, confirmado contra a API real em 2026-09-15), apesar de
 * a doc da HubMessage documentar o tipo neste endpoint.
 * `assertValidButtonsForProvider` roda aqui como defesa — o enfileiramento
 * já faz o mesmo pré-check antes de gravar a intenção — para que este
 * adapter nunca dependa de o chamador ter validado antes.
 *
 * Recusa de negócio (`4xx`, inclusive janela de 24h fechada) propaga a
 * mensagem legível do provider; indisponibilidade (`5xx`, rede) vira
 * `ButtonProviderUnavailableError` — mesmo corte de `HubMessageTemplateSender`.
 */
export class HubMessageInteractiveButtonSender implements InteractiveButtonSender {
  constructor(
    private readonly client: HubMessageClient,
    private readonly config: HubMessageInteractiveButtonSenderConfig,
  ) {}

  async send(
    descriptor: InteractiveButtonDescriptor,
  ): Promise<InteractiveButtonSendResult> {
    assertValidButtonsForProvider(
      ConnectorProvider.HUBMESSAGE,
      descriptor.buttons,
    )

    const { channelId, recipientIdentifier } = this.config
    // `assertValidButtonsForProvider` já garantiu que não há mistura de família.
    const isReply = descriptor.buttons[0]?.type === 'REPLY'

    const send = isReply
      ? this.client.sendInteractiveButton(channelId, {
          recipient: { identifier: recipientIdentifier },
          content: {
            type: 'INTERACTIVE_BUTTON',
            body: { message: descriptor.body },
            attachments: descriptor.buttons.map(toHubMessageQuickReplyButton),
          },
        })
      : this.client.sendInteractiveAction(channelId, {
          recipient: { identifier: recipientIdentifier },
          content: {
            type: 'INTERACTIVE_ACTION',
            ...(descriptor.header
              ? { header: { message: descriptor.header } }
              : {}),
            body: { message: descriptor.body },
            ...(descriptor.footer
              ? { footer: { message: descriptor.footer } }
              : {}),
            attachments: descriptor.buttons.map(toHubMessageButtonAction),
          },
        } satisfies SendHubMessageInteractiveActionParams)

    const { messageId } = await send.catch((error: unknown) => {
      if (!isProviderUnavailableError(error)) throw error

      log.error(
        { channelId, err: error, providerUnavailable: true },
        'HubMessage indisponível no envio de botões',
      )

      throw new ButtonProviderUnavailableError(
        error instanceof Error ? error.message : String(error),
      )
    })

    log.info(
      { channelId, buttonCount: descriptor.buttons.length, messageId },
      'Mensagem com botões enviada pela HubMessage',
    )

    return { messageId }
  }
}

function toHubMessageButtonAction(
  button: ButtonAction,
): HubMessageButtonAction {
  // `type` já validado como 'URL' por `assertValidButtonsForProvider`.
  return {
    id: button.id,
    title: button.label,
    name: 'URL',
    url: button.url ?? '',
  }
}

function toHubMessageQuickReplyButton(
  button: ButtonAction,
): HubMessageQuickReplyButtonAction {
  return { id: button.id, title: button.label }
}
