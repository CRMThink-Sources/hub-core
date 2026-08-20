import {
  OutboundMessageDescriptor,
  OutboundMessageSender,
  OutboundSendOptions,
  OutboundSendResult,
} from '@/modules/thinkzap/domain/ports/outbound-message-sender.port'
import { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { SendHubMessageParams } from '@/modules/thinkzap/infra/clients/types/hubmessage.types'
import { createWorkerSourceLogger } from '@/shared/infra/logger'

const log = createWorkerSourceLogger('hubmessage')

export type HubMessageOutboundSenderConfig = {
  channelId: string
  /**
   * Telefone do contato — o `chat.id` do evento do Bitrix.
   *
   * ATENÇÃO: isto só funciona porque o inbound grava `chat.id` = o
   * `sender.identifier` CRU da HubMessage (ver a doc da classe em
   * `process-hubmessage-inbound-message.use-case.ts`). Se alguém passar a
   * normalizar o `chat.id` no inbound, todo o outbound oficial quebra em
   * silêncio: o `recipient.identifier` deixaria de casar com o contato real.
   */
  recipientIdentifier: string
}

/**
 * Adapter HubMessage (WhatsApp Oficial) do contrato `OutboundMessageSender`.
 *
 * Duas capacidades que o Z-API tem e este provider não — a degradação fica
 * contida aqui, o chamador passa os mesmos dados para os dois:
 *
 * - **Documento**: a API não expõe `content.type = DOCUMENT`. Arquivo vira
 *   `TEXT` com nome + link; o registro ainda persiste como `DOCUMENT`.
 * - **Reply**: o payload de envio não tem campo de referência a mensagem. O
 *   `referencedMessageId` é ignorado com log.
 */
export class HubMessageOutboundSender implements OutboundMessageSender {
  readonly supportsReply = false

  constructor(
    private readonly client: HubMessageClient,
    private readonly config: HubMessageOutboundSenderConfig,
  ) {}

  async send(
    descriptor: OutboundMessageDescriptor,
    options?: OutboundSendOptions,
  ): Promise<OutboundSendResult> {
    const { channelId, recipientIdentifier } = this.config

    if (options?.referencedMessageId) {
      log.debug(
        {
          channelId,
          referencedMessageId: options.referencedMessageId,
          replyUnsupportedByProvider: true,
        },
        'HubMessage não suporta citar mensagem — enviando sem reply',
      )
    }

    const { params, persistedType, sentText } = this.buildPayload(descriptor)
    const { messageId } = await this.client.sendMessage(channelId, params)

    log.info(
      { channelId, messageId, contentType: params.content.type },
      'Message sent via HubMessage',
    )

    return { messageId, persistedType, sentText }
  }

  private buildPayload(descriptor: OutboundMessageDescriptor): {
    params: SendHubMessageParams
    persistedType: OutboundSendResult['persistedType']
    sentText?: string
  } {
    const recipient = { identifier: this.config.recipientIdentifier }

    switch (descriptor.kind) {
      case 'text':
        return {
          params: {
            recipient,
            content: { type: 'TEXT', body: { message: descriptor.text ?? '' } },
          },
          persistedType: 'TEXT',
          sentText: descriptor.text ?? '',
        }

      // `descriptor.text` em mídia é a legenda, e vai no anexo — não em
      // `content.body`, que a API só lê em `TEXT`.
      case 'image':
        return {
          params: {
            recipient,
            content: {
              type: 'IMAGE',
              attachments: [
                { url: descriptor.url ?? '', ...captionOf(descriptor) },
              ],
            },
          },
          persistedType: 'IMAGE',
          sentText: descriptor.text,
        }

      case 'video':
        return {
          params: {
            recipient,
            content: {
              type: 'VIDEO',
              attachments: [
                { url: descriptor.url ?? '', ...captionOf(descriptor) },
              ],
            },
          },
          persistedType: 'VIDEO',
          sentText: descriptor.text,
        }

      // Mídia vai por URL: sem o download + transcode para mp3/base64 que o
      // caminho Z-API faz, porque a HubMessage não aceita payload embutido.
      case 'audio':
        /**
         * Áudio não leva legenda (o WhatsApp não tem esse campo em nota de voz), e
         * o chamador já emite o texto como mensagem separada. Se ainda assim vier
         * texto aqui, é descartado com log — mandar como `caption` faria a API
         * recusar o envio inteiro.
         */
        if (descriptor.text) {
          log.info(
            {
              channelId: this.config.channelId,
              audioCaptionDropped: true,
            },
            'Áudio não suporta legenda — texto ignorado neste envio',
          )
        }
        return {
          params: {
            recipient,
            content: {
              type: 'AUDIO',
              attachments: [{ url: descriptor.url ?? '' }],
            },
          },
          persistedType: 'AUDIO',
        }

      case 'document': {
        const text = buildDocumentFallbackText(descriptor)
        log.info(
          {
            channelId: this.config.channelId,
            fileName: descriptor.fileName,
            documentFallbackApplied: true,
          },
          'HubMessage não suporta anexo de documento — enviando link como texto',
        )
        return {
          params: {
            recipient,
            content: { type: 'TEXT', body: { message: text } },
          },
          persistedType: 'DOCUMENT',
          sentText: text,
        }
      }
    }
  }
}

/** Legenda do anexo, ou nada — a chave só entra no payload quando há texto. */
function captionOf(descriptor: OutboundMessageDescriptor): {
  caption?: string
} {
  return descriptor.text ? { caption: descriptor.text } : {}
}

/**
 * O comentário do operador vem **antes** do nome + link: sem isto ele seria
 * descartado, já que o documento inteiro é degradado para uma única mensagem de
 * texto e não há segundo envio onde encaixá-lo.
 */
function buildDocumentFallbackText(
  descriptor: OutboundMessageDescriptor,
): string {
  const name = descriptor.fileName?.trim()
  const url = descriptor.url ?? ''
  const attachment = name ? `📎 ${name}\n${url}` : `📎 ${url}`
  const caption = descriptor.text?.trim()
  return caption ? `${caption}\n\n${attachment}` : attachment
}
