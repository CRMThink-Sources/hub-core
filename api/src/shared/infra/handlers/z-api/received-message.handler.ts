import { PrismaConnectorRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-connector.repository'
import { BitrixClient, ISendMessageData } from '../../clients/bitrix.client'
import { ZApiEventHandler } from '../z-api-event-handler'
import { ReceivedMessageEvent } from './z-api'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import { PrismaDomainRepository } from '../../persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '../../persistence/repositories/prisma-installed-app.repository'
import { PrismaCredentialRepository } from '../../persistence/repositories/prisma-credential.repository'
import { createChatId } from '@/shared/helpers/chat-id'

export class ReceivedMessageHandler implements ZApiEventHandler {
  eventType = 'ReceivedCallback'

  async handle(event: ReceivedMessageEvent): Promise<void> {
    if (this.checkIfMessageIsFromGroupOrNewsletter(event)) return

    const connectorRepo = new PrismaConnectorRepository()
    const instanceRepo = new PrismaInstanceRepository()

    const instance = await instanceRepo.getInstanceByInstanceId(
      event.instanceId,
    )
    if (!instance) return
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

    const bitrixClient = new BitrixClient(credential, domain?.name)
    const chatId = createChatId(event.chatLid || '', event.phone)

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
      CONNECTOR: 'hubthink_thinkzap',
      LINE: 208,
      MESSAGES: [
        {
          chat: {
            id: chatId,
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

    await bitrixClient.sendMessage(params)
  }

  private checkIfMessageIsFromGroupOrNewsletter(
    event: ReceivedMessageEvent,
  ): boolean {
    return event.isGroup || event.isNewsletter
  }
}
