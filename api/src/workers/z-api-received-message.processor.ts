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
import { logger } from '@/shared/infra/logger'

export async function processZApiReceivedMessage(event: ReceivedMessageEvent) {
  logger.info(
    {
      instanceId: event.instanceId,
      messageId: event.messageId,
      phone: event.phone,
      isGroup: event.isGroup,
    },
    'Processing received Z-API message',
  )

  const connectorRepo = new PrismaConnectorRepository()
  const instanceRepo = new PrismaInstanceRepository()

  const instance = await instanceRepo.getInstanceByInstanceId(event.instanceId)
  if (!instance) {
    logger.warn(
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
    logger.warn(
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
    logger.warn(
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
        : undefined

  const chatId = event.phone.includes('@lid') ? event.phone : event.chatLid
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
          id: event.phone,
          name: event.chatName ?? event.senderName,
          last_name: '',
          phone: event.phone,
          picture: {
            url: event.photo,
          },
        },
        message: {
          id: event.messageId,
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
  logger.debug(
    {
      messageId: event.messageId,
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

  const result: unknown = await bitrixClient.sendMessage(params)

  logger.info(
    {
      messageId: event.messageId,
      result: JSON.stringify(result),
    },
    'Message sent to Bitrix',
  )
}

async function sendMessageFromGroup(
  event: ReceivedMessageEvent,
  domain: Domain,
  credential: Credential,
  instance: Instance,
  files?: { url: string; name: string }[],
): Promise<void> {
  logger.info(
    {
      instanceId: event.instanceId,
      messageId: event.messageId,
      phone: event.phone,
      senderName: event.senderName,
    },
    'Processing group message for Bitrix',
  )

  const chatId = event.phone.includes('@lid') ? event.phone : event.chatLid
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
          name: event.chatName,
        },
        user: {
          id: event.phone,
          name: event.chatName ?? event.phone,
          last_name: '',
          phone: event.phone,
          picture: {
            url: event.photo,
          },
        },
        message: {
          id: event.messageId,
          date: new Date(event.momment).toISOString(),
          text:
            '[b]' +
            event.senderName +
            // event.participantPhone +
            '[/b]:\n' +
            (event.image
              ? event.image.caption
              : event.video
                ? event.video.caption
                : event.text?.message || ''),
          files,
        },
      },
    ],
  }
  const bitrixClient = new BitrixClient({
    bitrixCredential: credential,
    domain: domain?.name,
  })

  await bitrixClient.sendMessage(params)
}
