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
import {
  toQuoteInput,
  PrismaThinkzapMessageRepository,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import {
  ThinkzapMessageQuoteInput,
  buildMessageTextWithReply,
  extractQuoteInput,
  getQuoteInputType,
} from './build-reply-quote'

const log = createWorkerSourceLogger('z-api')

export class ProcessZApiInboundMessageUseCase {
  constructor(
    private readonly connectorRepo: GetConnectorRepository,
    private readonly instanceRepo: GetInstanceRepository,
    private readonly domainRepo: GetDomainRepository,
    private readonly appRepo: GetInstalledAppRepository,
    private readonly credentialRepo: GetCredentialRepository,
    private readonly messageRepo: PrismaThinkzapMessageRepository,
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
        referenceMessageId: event.referenceMessageId,
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
    const baseText = event.image
      ? event.image.caption
      : event.video
        ? event.video.caption
        : event.text?.message || ''

    const { text, cached, replyLookupFailed } = await this.applyReplyContext(
      event,
      baseText,
      instance.id,
    )

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
            text,
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
        hasReplyContext: Boolean(cached),
        replyLookupFailed,
        replyOriginalType: getQuoteInputType(cached),
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
        hasReplyContext: Boolean(cached),
        replyLookupFailed,
        replyOriginalType: getQuoteInputType(cached),
      },
      event.isEdit ? 'Message updated in Bitrix' : 'Message sent to Bitrix',
    )

    const bitrixMessageId = extractBitrixMessageId(result)
    console.log({ bitrixMessageId })
    const bitrixChatId = extractBitrixChatId(result)
    await this.persistInboundSnapshot(
      event,
      instance.id,
      bitrixMessageId,
      bitrixChatId,
      chatId,
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
        referenceMessageId: event.referenceMessageId,
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

    const baseText: string = event?.notification
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

    const { text, cached, replyLookupFailed } = await this.applyReplyContext(
      event,
      baseText,
      instance.id,
    )

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

    let result: unknown
    if (event.isEdit) {
      result = await bitrixClient.updateMessage(params)
    } else {
      result = await bitrixClient.sendMessage(params)
    }

    log.info(
      {
        instanceId: event.instanceId,
        messageId: event.messageId,
        isEdit: event.isEdit,
        hasReplyContext: Boolean(cached),
        replyLookupFailed,
        replyOriginalType: getQuoteInputType(cached),
      },
      event.isEdit
        ? 'Group message updated in Bitrix'
        : 'Group message sent to Bitrix',
    )

    const bitrixMessageId = extractBitrixMessageId(result)
    const bitrixChatId = extractBitrixChatId(result)
    await this.persistInboundSnapshot(
      event,
      instance.id,
      bitrixMessageId,
      bitrixChatId,
      chatId,
    )
  }

  private async applyReplyContext(
    event: ReceivedMessageEvent,
    baseText: string,
    instanceDbId: string,
  ): Promise<{
    text: string
    cached: ThinkzapMessageQuoteInput | null
    replyLookupFailed: boolean
  }> {
    if (!event.referenceMessageId) {
      return { text: baseText, cached: null, replyLookupFailed: false }
    }

    let cached: ThinkzapMessageQuoteInput | null = null
    let replyLookupFailed = false

    try {
      const record = await this.messageRepo.findByZApiMessageId(
        instanceDbId,
        event.referenceMessageId,
      )
      if (record) {
        cached = toQuoteInput(record)
      } else {
        replyLookupFailed = true
      }
    } catch (err) {
      replyLookupFailed = true
      log.warn(
        {
          instanceId: event.instanceId,
          referenceMessageId: event.referenceMessageId,
          replyLookupFailed: true,
          err,
        },
        'Reply lookup in DB failed',
      )
    }

    try {
      const text = buildMessageTextWithReply({ event, cached, baseText })
      return { text, cached, replyLookupFailed }
    } catch (err) {
      log.warn(
        {
          instanceId: event.instanceId,
          messageId: event.messageId,
          referenceMessageId: event.referenceMessageId,
          err,
          quoteBuildFailed: true,
        },
        'Failed to build reply quote — sending message without quote prefix',
      )
      return { text: baseText, cached, replyLookupFailed }
    }
  }

  private async persistInboundSnapshot(
    event: ReceivedMessageEvent,
    instanceDbId: string,
    bitrixMessageId: string | null,
    bitrixChatId: string | null,
    chatId: string | null,
  ): Promise<void> {
    if (event.notification === 'REVOKE' || event.isEdit) return

    try {
      const quoteInput = extractQuoteInput(event)
      await this.messageRepo.create({
        instanceId: instanceDbId,
        source: 'ZAPI',
        zApiMessageId: event.messageId,
        bitrixMessageId,
        bitrixChatId,
        type: quoteInput.type,
        text: quoteInput.text ?? null,
        fileName: quoteInput.fileName ?? null,
        chatId,
      })
    } catch (err) {
      log.warn(
        {
          instanceId: event.instanceId,
          messageId: event.messageId,
          err,
          dbWriteFailed: true,
        },
        'Failed to persist inbound message snapshot',
      )
    }
  }
}

function extractBitrixMessageId(result: unknown): string | null {
  try {
    const r = result as {
      result: { DATA?: { RESULT?: Array<{ message?: { id?: string } }> } }
    }
    console.log(r.result?.DATA?.RESULT?.[0])
    return r.result?.DATA?.RESULT?.[0]?.message?.id ?? null
  } catch {
    return null
  }
}

function extractBitrixChatId(result: unknown): string | null {
  try {
    const r = result as {
      DATA?: { RESULT?: Array<{ session?: { CHAT_ID?: string } }> }
    }
    return r?.DATA?.RESULT?.[0]?.session?.CHAT_ID ?? null
  } catch {
    return null
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
  if (event.sticker)
    return [{ url: event.sticker.stickerUrl, name: 'Sticker.webp' }]
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
