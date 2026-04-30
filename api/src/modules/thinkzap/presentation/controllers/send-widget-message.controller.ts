import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { convertToMp3 } from '@/shared/helpers/convert-to-mp3'
import {
  isValidZApiPhoneNumber,
  normalizePhoneNumber,
} from '@/shared/helpers/normalize-phone-number'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import z from 'zod'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { SendNotification } from '@/shared/data/contracts/send-notification'

const attachmentSchema = z.object({
  kind: z.enum(['image', 'video', 'audio', 'file']),
  content: z.string().min(1),
  name: z.string().optional(),
})

export class SendWidgetMessageController extends Controller {
  constructor(
    private readonly getConnectorRepository: GetConnectorRepository,
    private readonly getInstanceRepository: GetInstanceRepository,
    private readonly zApiClient: ZApiClient,
    private readonly sendBitrixNotification: SendNotification,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const parsed = z
      .object({
        connectorId: z.string().min(1),
        destination: z.string().min(1),
        message: z.string().trim().min(1).optional(),
        attachments: z.array(attachmentSchema).optional(),
        entity: z.string().min(1),
        entityId: z.string().min(1),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    const {
      connectorId,
      destination,
      message,
      attachments = [],
      entity,
      entityId,
    } = parsed.data
    if (!message && attachments.length === 0) {
      return this.badRequest(
        new Error('Message or at least one attachment is required'),
      )
    }

    const connector = await this.getConnectorRepository.get(connectorId)
    if (!connector) {
      return this.notFound(new Error('Connector not found'))
    }

    const instance = await this.getInstanceRepository.getInstance(
      connector.instanceId,
    )
    if (!instance) {
      return this.notFound(new Error('Instance not found'))
    }
    if (!instance.zApiToken) {
      return this.badRequest(new Error('Instance token not found'))
    }
    const phoneData = await this.zApiClient.getPhoneData(
      instance.instanceId,
      instance.zApiToken,
    )

    const normalizedPhone = normalizePhoneNumber(destination)
    if (!isValidZApiPhoneNumber(normalizedPhone)) {
      return this.badRequest(new Error('Invalid destination phone number'))
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
      if (attachment.kind === 'image') {
        const result = await this.zApiClient.sendImage(
          instance.instanceId,
          instance.zApiToken,
          attachment.content,
          normalizedPhone,
        )
        sentMessageIds.push(result.messageId)
        continue
      }

      if (attachment.kind === 'video') {
        const result = await this.zApiClient.sendVideo(
          instance.instanceId,
          instance.zApiToken,
          attachment.content,
          normalizedPhone,
        )
        sentMessageIds.push(result.messageId)
        continue
      }

      if (attachment.kind === 'audio') {
        const mp3Audio = await this.convertAudioToMp3DataUrl(attachment.content)
        const result = await this.zApiClient.sendAudio(
          instance.instanceId,
          instance.zApiToken,
          mp3Audio,
          normalizedPhone,
        )
        sentMessageIds.push(result.messageId)
        continue
      }

      const result = await this.zApiClient.sendDocument(
        instance.instanceId,
        instance.zApiToken,
        attachment.content,
        normalizedPhone,
        attachment.name,
      )
      sentMessageIds.push(result.messageId)
    }

    await this.sendBitrixNotification.execute({
      contextId: entityId,
      entity,
      message: `De: ${phoneData?.phone ?? ''}\nPara: ${destination}\nMensagem: ${message?.trim() || ''}`,
    })

    return this.ok({
      message: 'Message sent successfully',
      destination: normalizedPhone,
      sentMessageIds,
    })
  }

  private async convertAudioToMp3DataUrl(
    audioContent: string,
  ): Promise<string> {
    const base64Audio = this.extractBase64Payload(audioContent)

    if (!base64Audio) {
      throw new Error('Invalid audio payload')
    }

    const inputBuffer = Buffer.from(base64Audio, 'base64')
    const mp3Buffer = await convertToMp3(inputBuffer)
    return `data:audio/mpeg;base64,${mp3Buffer.toString('base64')}`
  }

  private extractBase64Payload(content: string): string {
    const dataUrlSeparator = ';base64,'
    if (content.includes(dataUrlSeparator)) {
      return content.split(dataUrlSeparator)[1] ?? ''
    }

    return content.trim()
  }
}
