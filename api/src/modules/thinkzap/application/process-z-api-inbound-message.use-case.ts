import { env } from '@/config/env'
import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import {
  BitrixClient,
  ISendMessageData,
} from '@/shared/infra/clients/bitrix.client'
import { ReceivedMessageEvent } from '@/shared/infra/handlers/z-api/z-api'
import { GetCredentialRepository } from '@/shared/domain/repositories/credential/get-credential'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { Domain } from '@/shared/domain/entities/domain'
import { Credential } from '@/shared/domain/entities/credential'
import { Instance } from '@/modules/thinkzap/domain/entities/instance'
import { createWorkerSourceLogger } from '@/shared/infra/logger'

const log = createWorkerSourceLogger('z-api')

export class ProcessZApiInboundMessageUseCase {
  constructor(
    private readonly connectorRepo: GetConnectorRepository,
    private readonly instanceRepo: GetInstanceRepository,
    private readonly domainRepo: GetDomainRepository,
    private readonly appRepo: GetInstalledAppRepository,
    private readonly credentialRepo: GetCredentialRepository,
  ) {}

  async execute(event: ReceivedMessageEvent): Promise<void> {
    log.info(
      {
        instanceId: event.instanceId,
        messageId: event.messageId,
        phone: event.phone,
        isGroup: event.isGroup,
        isEdit: event.isEdit,
        editMessageId: event.editMessageId,
      },
      'Processing received Z-API message',
    )

    if (event.isEdit && !event.editMessageId) {
      log.warn(
        {
          instanceId: event.instanceId,
          messageId: event.messageId,
        },
        'isEdit=true but editMessageId missing — skipping',
      )
      return
    }

    const instance = await this.instanceRepo.getInstanceByInstanceId(
      event.instanceId,
    )
    if (!instance) {
      log.warn(
        {
          instanceId: event.instanceId,
          messageId: event.messageId,
          instance: JSON.stringify(instance),
        },
        'Instance not found for received message',
      )
      throw new Error('Instance not found for received message')
    }
    if (!instance.vinculatedChannel) {
      log.warn(
        {
          instanceId: event.instanceId,
          internalInstanceId: instance.id,
          messageId: event.messageId,
        },
        'Instance has no vinculated channel',
      )
      throw new Error('Instance has no vinculated channel')
    }

    const connector = await this.connectorRepo.getConnectorByInstanceId(
      instance.id,
    )
    if (!connector) {
      log.warn(
        {
          instanceId: event.instanceId,
          internalInstanceId: instance.id,
          messageId: event.messageId,
        },
        'Connector not found for instance',
      )
      throw new Error('Connector not found for instance')
    }

    const { domainId } = instance
    const { appId } = connector

    if (!domainId || !appId) {
      throw new Error('Domain ID and app ID are required')
    }

    const domain = await this.domainRepo.getDomainById(domainId)
    const app = await this.appRepo.getById(appId)

    if (!app) {
      throw new Error('App not found')
    }

    const credential = await this.credentialRepo.get({ appId: app.id })

    if (!domain || !credential) {
      throw new Error('Domain or credential not found')
    }

    const bitrixClient = new BitrixClient({
      bitrixCredential: credential,
      domain: domain.name,
    })

    const files = buildMessageFiles(event)

    if (event.isGroup) {
      await this.sendGroupMessage(event, domain, credential, instance, files)
      return
    }

    const chatId = resolveChatId(event)
    if (!chatId) {
      throw new Error('Chat ID not found')
    }

    const outgoingMessageId = event.messageId

    const params: ISendMessageData = {
      CONNECTOR: env.bitrix.connector.code,
      LINE: Number(instance.vinculatedChannel),
      MESSAGES: [
        {
          chat: {
            id: chatId,
            name: event.chatName + ' - ' + event.phone,
          },
          user: {
            id: chatId,
            name: event.chatName ?? event.senderName,
            last_name: '',
            phone: event.phone,
            picture: {
              url: event.photo,
            },
          },
          message: {
            id: outgoingMessageId,
            date: new Date(event.momment).toISOString(),
            text: event.image
              ? event.image.caption
              : event.video
                ? event.video.caption
                : event.text?.message || '',
            files,
          },
        },
      ],
    }

    log.debug(
      {
        messageId: event.messageId,
        outgoingMessageId,
        isEdit: event.isEdit,
        connectorCode: params.CONNECTOR,
        channel: params.LINE,
        filesCount: files?.length ?? 0,
      },
      'Prepared message payload to send to Bitrix',
    )

    const result: unknown = event.isEdit
      ? await bitrixClient.updateMessage(params)
      : event.notification === 'REVOKE'
        ? await bitrixClient.deleteMessage(params)
        : await bitrixClient.sendMessage(params)

    log.info(
      {
        messageId: event.messageId,
        outgoingMessageId,
        isEdit: event.isEdit,
        result: JSON.stringify(result),
      },
      event.isEdit ? 'Message updated in Bitrix' : 'Message sent to Bitrix',
    )
  }

  private async sendGroupMessage(
    event: ReceivedMessageEvent,
    domain: Domain,
    credential: Credential,
    instance: Instance,
    files?: { url: string; name: string }[],
  ): Promise<void> {
    log.info(
      {
        instanceId: event.instanceId,
        messageId: event.messageId,
        phone: event.phone,
        senderName: event.senderName,
        isEdit: event.isEdit,
        editMessageId: event.editMessageId,
      },
      'Processing group message for Bitrix',
    )

    const chatId = resolveGroupChatId(event)
    if (!chatId) {
      throw new Error('Chat ID not found')
    }

    const outgoingMessageId = event.isEdit
      ? event.editMessageId
      : event.messageId

    log.debug(
      {
        instanceId: event.instanceId,
        messageId: event.messageId,
        isEdit: event.isEdit,
        editMessageId: event.editMessageId,
        outgoingMessageId,
      },
      'Group message routing',
    )

    const getNotificationMessage = {
      GROUP_CHANGE_ICON: 'The group icon has been changed',
      GROUP_CREATE: 'A new group has been created',
    }

    const text: string = event?.notification
      ? (getNotificationMessage[
          event.notification as keyof typeof getNotificationMessage
        ] ?? '')
      : '[b]' +
        event.senderName +
        '[/b]:\n' +
        (event.image
          ? event.image.caption
          : event.video
            ? event.video.caption
            : event.text?.message || '')

    const params: ISendMessageData = {
      CONNECTOR: env.bitrix.connector.code,
      LINE: Number(instance.vinculatedChannel),
      MESSAGES: [
        {
          chat: {
            id: chatId,
            name: event.chatName,
          },
          user: {
            id: chatId,
            name: event.chatName ?? event.phone,
            last_name: '',
            phone: event.phone,
            picture: {
              url: event.photo,
            },
          },
          message: {
            id: outgoingMessageId,
            date: new Date(event.momment).toISOString(),
            text,
            files,
          },
        },
      ],
    }

    const bitrixClient = new BitrixClient({
      bitrixCredential: credential,
      domain: domain.name,
    })

    if (event.isEdit) {
      await bitrixClient.updateMessage(params)
    } else {
      await bitrixClient.sendMessage(params)
    }
  }
}

function buildMessageFiles(
  event: ReceivedMessageEvent,
): { url: string; name: string }[] | undefined {
  if (event.image)
    return [{ url: event.image.imageUrl, name: event.image.mimeType }]
  if (event.audio)
    return [{ url: event.audio.audioUrl, name: 'Mensagem de áudio.mp3' }]
  if (event.video)
    return [{ url: event.video.videoUrl, name: 'Mensagem de vídeo.mp4' }]
  if (event.document)
    return [{ url: event.document.documentUrl, name: event.document.fileName }]
  return undefined
}

function resolveChatId(event: ReceivedMessageEvent): string | null {
  if (event.phone.includes('@lid') || event.phone.includes('-group')) {
    return event.phone
  }
  return event.chatLid
}

function resolveGroupChatId(event: ReceivedMessageEvent): string | null {
  return event.phone.includes('-group') ? event.phone : event.chatLid
}
