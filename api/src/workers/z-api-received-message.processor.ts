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

export async function processZApiReceivedMessage(event: ReceivedMessageEvent) {
  const connectorRepo = new PrismaConnectorRepository()
  const instanceRepo = new PrismaInstanceRepository()

  const instance = await instanceRepo.getInstanceByInstanceId(event.instanceId)
  if (!instance) return
  if (!instance.vinculatedChannel) return
  const connector = await connectorRepo.getConnectorByInstanceId(instance?.id)
  if (!connector) return

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
            name: 'Mensagem de áudio',
          },
        ]
      : event.video
        ? [
            {
              url: event.video.videoUrl,
              name: 'Mensagem de vídeo',
            },
          ]
        : undefined

  const params: ISendMessageData = {
    CONNECTOR: env.bitrix.connector.code,
    LINE: Number(instance.vinculatedChannel),
    MESSAGES: [
      {
        chat: {
          id: event.phone,
          name: event.chatName,
        },
        user: {
          id: event.phone,
          name: event.chatName,
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
  console.log('params', params.MESSAGES)
  if (event.isGroup) {
    await sendMessageFromGroup(event, domain, credential, instance, files)
    return
  }

  await bitrixClient.sendMessage(params)
}

async function sendMessageFromGroup(
  event: ReceivedMessageEvent,
  domain: Domain,
  credential: Credential,
  instance: Instance,
  files?: { url: string; name: string }[],
): Promise<void> {
  console.log('sendMessageFromGroup', event)

  const params: ISendMessageData = {
    CONNECTOR: env.bitrix.connector.code,
    LINE: Number(instance.vinculatedChannel),
    MESSAGES: [
      {
        chat: {
          id: event.phone,
          name: event.chatName,
        },
        user: {
          id: event.phone,
          name: event.chatName,
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
