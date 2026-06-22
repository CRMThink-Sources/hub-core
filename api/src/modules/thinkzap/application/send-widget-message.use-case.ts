import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { convertToMp3 } from '@/shared/helpers/convert-to-mp3'
import {
  isValidZApiPhoneNumber,
  normalizePhoneNumber,
} from '@/shared/helpers/normalize-phone-number'
import { SendNotification } from '@/shared/data/contracts/send-notification'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { env } from '@/config/env'
import {
  SendWidgetMessageInput,
  SendWidgetMessageResult,
  WidgetMessageAttachmentInput,
} from './send-widget-message.types'

export class SendWidgetMessageUseCase {
  constructor(
    private readonly getConnectorRepository: GetConnectorRepository,
    private readonly getInstanceRepository: GetInstanceRepository,
    private readonly zApiClient: ZApiClient,
    private readonly sendBitrixNotification: SendNotification,
    private readonly bitrixClient: BitrixClient,
  ) {}

  async execute(
    input: SendWidgetMessageInput,
  ): Promise<SendWidgetMessageResult> {
    const {
      connectorId,
      destination,
      message,
      attachments = [],
      entity,
      entityId,
    } = input

    if (!message?.trim() && attachments.length === 0) {
      throw new Error('Message or at least one attachment is required')
    }

    const connector = await this.getConnectorRepository.get(connectorId)
    if (!connector) {
      throw new Error('Connector not found')
    }

    const instance = await this.getInstanceRepository.getInstance(
      connector.instanceId,
    )
    if (!instance) {
      throw new Error('Instance not found')
    }
    if (!instance.zApiToken) {
      throw new Error('Instance token not found')
    }

    const phoneData = await this.zApiClient.getPhoneData(
      instance.instanceId,
      instance.zApiToken,
    )

    const normalizedPhone = normalizePhoneNumber(destination)
    if (!isValidZApiPhoneNumber(normalizedPhone)) {
      throw new Error('Invalid destination phone number')
    }

    const sentMessageIds: string[] = []

    if (message?.trim()) {
      const result = await this.zApiClient.sendMessage(
        instance.instanceId,
        instance.zApiToken,
        message.trim(),
        normalizedPhone,
      )
      sentMessageIds.push(result.messageId)
    }

    for (const attachment of attachments) {
      const messageId = await this.sendAttachment(
        attachment,
        instance.instanceId,
        instance.zApiToken,
        normalizedPhone,
      )
      sentMessageIds.push(messageId)
    }

    if (instance.vinculatedChannel) {
      const openChannelText = message?.trim() || '[Arquivo enviado]'
      try {
        await this.bitrixClient.sendToOpenChannel(
          instance.vinculatedChannel,
          env.bitrix.connector.code,
          normalizedPhone,
          openChannelText,
        )
      } catch (err) {
        console.error(
          '[SendWidgetMessageUseCase] sendToOpenChannel error:',
          err,
        )
      }
    }

    await this.sendBitrixNotification.execute({
      contextId: entityId,
      entity,
      message: `De: ${phoneData?.phone ?? ''}\nPara: ${destination}\nMensagem: ${message?.trim() || ''}`,
    })

    return {
      message: 'Message sent successfully',
      destination: normalizedPhone,
      sentMessageIds,
    }
  }

  private async sendAttachment(
    attachment: WidgetMessageAttachmentInput,
    instanceId: string,
    zApiToken: string,
    normalizedPhone: string,
  ): Promise<string> {
    if (attachment.kind === 'image') {
      const result = await this.zApiClient.sendImage(
        instanceId,
        zApiToken,
        attachment.content,
        normalizedPhone,
      )
      return result.messageId
    }

    if (attachment.kind === 'video') {
      const result = await this.zApiClient.sendVideo(
        instanceId,
        zApiToken,
        attachment.content,
        normalizedPhone,
      )
      return result.messageId
    }

    if (attachment.kind === 'audio') {
      const mp3Audio = await this.convertAudioToMp3DataUrl(attachment.content)
      const result = await this.zApiClient.sendAudio(
        instanceId,
        zApiToken,
        mp3Audio,
        normalizedPhone,
      )
      return result.messageId
    }

    const result = await this.zApiClient.sendDocument(
      instanceId,
      zApiToken,
      attachment.content,
      normalizedPhone,
      attachment.name,
    )
    return result.messageId
  }

  async convertAudioBufferToMp3DataUrl(inputBuffer: Buffer): Promise<string> {
    const mp3Buffer = await convertToMp3(inputBuffer)
    return `data:audio/mpeg;base64,${mp3Buffer.toString('base64')}`
  }

  private async convertAudioToMp3DataUrl(
    audioContent: string,
  ): Promise<string> {
    const base64Audio = this.extractBase64Payload(audioContent)

    if (!base64Audio) {
      throw new Error('Invalid audio payload')
    }

    const inputBuffer = Buffer.from(base64Audio, 'base64')
    return this.convertAudioBufferToMp3DataUrl(inputBuffer)
  }

  private extractBase64Payload(content: string): string {
    const dataUrlSeparator = ';base64,'
    if (content.includes(dataUrlSeparator)) {
      return content.split(dataUrlSeparator)[1] ?? ''
    }

    return content.trim()
  }
}

export function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

export function guessMimeTypeFromFileName(fileName?: string): string {
  if (!fileName) return 'application/octet-stream'
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.mp4')) return 'video/mp4'
  if (lower.endsWith('.webm')) return 'video/webm'
  if (lower.endsWith('.ogg')) return 'audio/ogg'
  if (lower.endsWith('.mp3')) return 'audio/mpeg'
  if (lower.endsWith('.wav')) return 'audio/wav'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  return 'application/octet-stream'
}
