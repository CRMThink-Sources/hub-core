import axios from 'axios'

import {
  OutboundMessageDescriptor,
  OutboundMessageSender,
  OutboundSendOptions,
  OutboundSendResult,
} from '@/modules/thinkzap/domain/ports/outbound-message-sender.port'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { convertToMp3 } from '@/shared/helpers/convert-to-mp3'

export type ZApiOutboundSenderConfig = {
  instanceId: string
  instanceToken: string
  /** Telefone do contato — `chat.id` do evento do Bitrix. */
  phone: string
}

/**
 * Adapter Z-API do contrato `OutboundMessageSender`. Extração literal do que
 * antes vivia inline em `bitrix-received-message.processor.ts` — o Z-API aceita
 * payload embutido, por isso o áudio continua sendo baixado e convertido para
 * mp3/base64 aqui.
 */
export class ZApiOutboundSender implements OutboundMessageSender {
  readonly supportsReply = true

  constructor(
    private readonly client: ZApiClient,
    private readonly config: ZApiOutboundSenderConfig,
  ) {}

  async send(
    descriptor: OutboundMessageDescriptor,
    options?: OutboundSendOptions,
  ): Promise<OutboundSendResult> {
    const { instanceId, instanceToken, phone } = this.config

    switch (descriptor.kind) {
      case 'text': {
        const result = await this.client.sendMessage(
          instanceId,
          instanceToken,
          descriptor.text ?? '',
          phone,
          { referencedMessageId: options?.referencedMessageId },
        )
        return {
          messageId: result.messageId,
          persistedType: 'TEXT',
          sentText: descriptor.text ?? '',
        }
      }

      // `descriptor.text` em mídia é a legenda — o campo `caption` do Z-API. Sem
      // legenda a chave nem entra no corpo.
      case 'image': {
        const result = await this.client.sendImage(
          instanceId,
          instanceToken,
          descriptor.url ?? '',
          phone,
          { caption: descriptor.text },
        )
        return {
          messageId: result.messageId,
          persistedType: 'IMAGE',
          sentText: descriptor.text,
        }
      }

      case 'video': {
        const result = await this.client.sendVideo(
          instanceId,
          instanceToken,
          descriptor.url ?? '',
          phone,
          { caption: descriptor.text },
        )
        return {
          messageId: result.messageId,
          persistedType: 'VIDEO',
          sentText: descriptor.text,
        }
      }

      case 'audio': {
        const audioResponse = await axios.get<ArrayBuffer>(
          descriptor.url ?? '',
          { responseType: 'arraybuffer' },
        )
        const mp3Buffer = await convertToMp3(Buffer.from(audioResponse.data))
        const base64Audio = `data:audio/mpeg;base64,${mp3Buffer.toString('base64')}`

        const result = await this.client.sendAudio(
          instanceId,
          instanceToken,
          base64Audio,
          phone,
        )
        return { messageId: result.messageId, persistedType: 'AUDIO' }
      }

      case 'document': {
        const result = await this.client.sendDocument(
          instanceId,
          instanceToken,
          descriptor.url ?? '',
          phone,
          descriptor.fileName ?? '',
          { caption: descriptor.text },
        )
        return {
          messageId: result.messageId,
          persistedType: 'DOCUMENT',
          sentText: descriptor.text,
        }
      }
    }
  }
}
