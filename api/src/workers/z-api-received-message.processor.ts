import { env } from '@/config/env'
import { PrismaConnectorRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-connector.repository'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import {
  BitrixClient,
  ISendMessageData,
} from '@/shared/infra/clients/bitrix.client'
import { ReceivedMessageEvent } from '@/shared/infra/handlers/z-api/z-api'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { Domain, Instance } from '@/prisma/client'
import { Credential } from '@/shared/domain/entities/credential'
import { createWorkerSourceLogger } from '@/shared/infra/logger'

const log = createWorkerSourceLogger('z-api')

export async function processZApiReceivedMessage(event: ReceivedMessageEvent) {
  log.info(
    {
      instanceId: event.instanceId,
      messageId: event.messageId,
      phone: event.phone,
      isGroup: event.isGroup,
      isEdit: event.isEdit,
      referenceMessageId: event.referenceMessageId,
    },
    'Processing received Z-API message',
  )

  if (event.isEdit && !event.referenceMessageId) {
    log.warn(
      {
        instanceId: event.instanceId,
        messageId: event.messageId,
      },
      'isEdit=true but referenceMessageId missing — skipping',
    )
    return
  }

  const outgoingMessageId = event.isEdit
    ? event.referenceMessageId
    : event.messageId

  const connectorRepo = new PrismaConnectorRepository()
  const instanceRepo = new PrismaInstanceRepository()

  const instance = await instanceRepo.getInstanceByInstanceId(event.instanceId)
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
  const connector = await connectorRepo.getConnectorByInstanceId(instance?.id)
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
  const getDomainRepo = new PrismaDomainRepository()
  const domain = await getDomainRepo.getDomainById(domainId)
  const getAppRepo = new PrismaInstalledAppRepository()
  const app = await getAppRepo.getById(appId)

  if (!app) {
    throw new Error('App not found')
  }

  const credentialRepo = new PrismaCredentialRepository()
  const credential = await credentialRepo.get({ appId: app?.id })

  if (!domain || !credential) {
    throw new Error('Domain or credential not found')
  }

  const bitrixClient = new BitrixClient({
    bitrixCredential: credential,
    domain: domain?.name,
  })

  const files = event.image
    ? [
        {
          url: event.image.imageUrl,
          name: event.image.mimeType,
        },
      ]
    : event.audio
      ? [
          {
            url: event.audio.audioUrl,
            name: 'Mensagem de áudio.mp3',
          },
        ]
      : event.video
        ? [
            {
              url: event.video.videoUrl,
              name: 'Mensagem de vídeo.mp4',
            },
          ]
        : event.document
          ? [
              {
                url: event.document.documentUrl,
                name: event.document.fileName,
              },
            ]
          : undefined

  const chatId = event.phone.includes('@lid')
    ? event.phone
    : event.phone.includes('-group')
      ? event.phone
      : event.chatLid

  if (!chatId) {
    throw new Error('Chat ID not found')
  }

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
  if (event.isGroup) {
    await sendMessageFromGroup(
      event,
      domain,
      credential,
      instance as unknown as Instance,
      files,
    )
    return
  }

  const result: unknown = event.isEdit
    ? await bitrixClient.updateMessage(params)
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

async function sendMessageFromGroup(
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
      referenceMessageId: event.referenceMessageId,
    },
    'Processing group message for Bitrix',
  )

  const chatId = event.phone.includes('-group') ? event.phone : event.chatLid
  if (!chatId) {
    throw new Error('Chat ID not found')
  }

  const outgoingMessageId = event.isEdit
    ? event.referenceMessageId
    : event.messageId

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
    domain: domain?.name,
  })

  if (event.isEdit) {
    await bitrixClient.updateMessage(params)
  } else {
    await bitrixClient.sendMessage(params)
  }
}
