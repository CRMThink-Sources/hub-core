import axios from 'axios'

import { env } from '@/config/env'
import { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { appIdResolver } from '@/modules/auth/presentation/controllers/helpers/app-id-resolver'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { convertToMp3 } from '@/shared/helpers/convert-to-mp3'
import { GetBitrixWebhookContextRepository } from '@/modules/thinkzap/domain/repositories/get-bitrix-webhook-context.repository'
import { PrismaBitrixWebhookContextRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-bitrix-webhook-context.repository'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { BitrixGetUserDisplayNameAdapter } from '@/modules/thinkzap/infra/adapters/bitrix-get-user-display-name.adapter'
import { PrismaAllowedUserRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-allowed-user.repository'
import { prepareOpenLineOutboundText } from '@/modules/thinkzap/application/prepare-open-line-outbound-text'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { ensureBitrixBotId } from '@/modules/thinkzap/application/ensure-bitrix-bot-id'
import { resolveBitrixReplyContext } from '@/modules/thinkzap/application/resolve-bitrix-reply-context'
import { redisConnection } from '@/queue/redis-connection'

const log = createWorkerSourceLogger('bitrix')
const messageRepo = new PrismaThinkzapMessageRepository()

type BitrixMessageGetResult = {
  result: {
    message: {
      id: number
      chatId: number
      authorId: number
      text: string
      params?: {
        REPLY_ID?: string
      }
    }
  }
}

async function persistOutboundMessage(
  instanceId: string,
  zApiMessageId: string,
  bitrixMessageId: string,
  chatId: string,
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT',
  text?: string,
  fileName?: string,
): Promise<void> {
  try {
    await messageRepo.create({
      instanceId,
      source: 'BITRIX',
      zApiMessageId,
      bitrixMessageId,
      type,
      text: text ?? null,
      fileName: fileName ?? null,
      chatId,
    })
  } catch (err) {
    log.warn(
      { instanceId, zApiMessageId, bitrixMessageId, err, dbWriteFailed: true },
      'Failed to persist outbound message to DB',
    )
  }
}

export async function processBitrixReceivedMessage(
  event: IBX24MessageEvent,
): Promise<void> {
  log.info(
    {
      domain: event.auth.domain,
      line: event.data.LINE,
      messagesCount: event.data.MESSAGES.length,
    },
    'Processing Bitrix outbound message',
  )
  if (!event.data.MESSAGES.length) {
    log.warn(
      { domain: event.auth.domain, line: event.data.LINE },
      'Bitrix event received with no messages — skipping',
    )
    return
  }

  const message = event.data
    .MESSAGES[0] as IBX24MessageEvent['data']['MESSAGES'][number]

  const messages: Array<{
    type: string
    text?: string
    name?: string
    mime?: string
    link?: string
  }> = []

  if (message.message.text) {
    messages.push({ type: 'text', text: message.message.text })
  } else if (message.message.files) {
    for (const file of message.message.files) {
      const type = file.name.includes('audio-') ? 'audio' : file.type
      messages.push({
        type,
        name: file.name,
        mime: file.mime,
        link: file.downloadLink,
      })
    }
  }

  log.debug(
    {
      domain: event.auth.domain,
      line: event.data.LINE,
      parsedMessages: messages.map(m => ({ type: m.type })),
    },
    'Bitrix messages parsed',
  )

  const bitrixWebhookContextRepo: GetBitrixWebhookContextRepository =
    new PrismaBitrixWebhookContextRepository()

  const context = await bitrixWebhookContextRepo.getContext({
    domainName: event.auth.domain,
    appCode: appIdResolver[env.appCodes.thinkzap] || '',
    line: event.data.LINE,
  })

  if (!context) {
    log.error(
      { domain: event.auth.domain, line: event.data.LINE },
      'Bitrix webhook context not found',
    )
    throw new Error('Context not found')
  }

  log.debug(
    {
      domain: event.auth.domain,
      instanceId: context.instance.instanceId,
      internalInstanceId: context.instance.id,
    },
    'Bitrix webhook context resolved',
  )

  const bitrixClient = new BitrixClient({
    bitrixCredential: context.app.credential,
    domain: context.name,
  })

  const botId = await ensureBitrixBotId(
    bitrixClient,
    redisConnection,
    context.name,
    env.appCodes.thinkzap,
  )
  console.log({ botId })
  const response = await bitrixClient.callMethod<BitrixMessageGetResult>(
    'imbot.v2.Chat.Message.get',
    {
      botId,
      messageId: message.im.message_id,
    },
  )

  const replyId = response.result?.message?.params?.REPLY_ID
  console.log({ replyId })
  const referencedMessageId = await resolveBitrixReplyContext(
    context.instance.id,
    replyId,
    messageRepo,
  )
  console.log({ referencedMessageId })
  if (replyId) {
    log.debug(
      {
        domain: event.auth.domain,
        instanceId: context.instance.instanceId,
        replyId,
        replyResolved: !!referencedMessageId,
      },
      'Bitrix reply context resolved',
    )
  }

  const getBitrixUserDisplayName = new BitrixGetUserDisplayNameAdapter(
    bitrixClient,
  )
  const getAllowedUser = new PrismaAllowedUserRepository()

  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)
  const chatId = message.chat.id
  const bitrixMessageId = message.im.message_id
  const instanceDbId = context.instance.id

  for (const messageData of messages) {
    log.debug(
      {
        domain: event.auth.domain,
        instanceId: context.instance.instanceId,
        chatId,
        messageType: messageData.type,
      },
      'Sending message via Z-API',
    )

    if (messageData.type === 'text') {
      const outboundText = await prepareOpenLineOutboundText({
        text: messageData.text || '',
        settings: context.instance.settings,
        operatorUserId: message.message.user_id,
        appId: context.app.id,
        getBitrixUserDisplayName,
        getAllowedUser,
      })

      const result = await zApiClient.sendMessage(
        context.instance.instanceId,
        context.instance.zApiToken || '',
        outboundText,
        chatId,
        { referencedMessageId },
      )
      log.info(
        {
          domain: event.auth.domain,
          instanceId: context.instance.instanceId,
          chatId,
          zApiMessageId: result.messageId,
        },
        'Text message sent via Z-API',
      )
      await persistOutboundMessage(
        instanceDbId,
        result.messageId,
        bitrixMessageId,
        chatId,
        'TEXT',
        outboundText,
      )
      await setDelivered(bitrixClient, event, message, chatId, result.messageId)
    } else if (messageData.type === 'image') {
      const result = await zApiClient.sendImage(
        context.instance.instanceId,
        context.instance.zApiToken || '',
        messageData.link || '',
        chatId,
      )
      log.info(
        {
          domain: event.auth.domain,
          instanceId: context.instance.instanceId,
          chatId,
          zApiMessageId: result.messageId,
        },
        'Image message sent via Z-API',
      )
      await persistOutboundMessage(
        instanceDbId,
        result.messageId,
        bitrixMessageId,
        chatId,
        'IMAGE',
      )
      await setDelivered(bitrixClient, event, message, chatId, result.messageId)
    } else if (messageData.type === 'video') {
      const result = await zApiClient.sendVideo(
        context.instance.instanceId,
        context.instance.zApiToken || '',
        messageData.link || '',
        chatId,
      )
      log.info(
        {
          domain: event.auth.domain,
          instanceId: context.instance.instanceId,
          chatId,
          zApiMessageId: result.messageId,
        },
        'Video message sent via Z-API',
      )
      await persistOutboundMessage(
        instanceDbId,
        result.messageId,
        bitrixMessageId,
        chatId,
        'VIDEO',
      )
      await setDelivered(bitrixClient, event, message, chatId, result.messageId)
    } else if (messageData.type === 'audio') {
      const audioResponse = await axios.get<ArrayBuffer>(
        messageData.link || '',
        { responseType: 'arraybuffer' },
      )
      const mp3Buffer = await convertToMp3(Buffer.from(audioResponse.data))
      const base64Audio = `data:audio/mpeg;base64,${mp3Buffer.toString('base64')}`

      const result = await zApiClient.sendAudio(
        context.instance.instanceId,
        context.instance.zApiToken || '',
        base64Audio,
        chatId,
      )
      log.info(
        {
          domain: event.auth.domain,
          instanceId: context.instance.instanceId,
          chatId,
          zApiMessageId: result.messageId,
        },
        'Audio message sent via Z-API',
      )
      await persistOutboundMessage(
        instanceDbId,
        result.messageId,
        bitrixMessageId,
        chatId,
        'AUDIO',
      )
      await setDelivered(bitrixClient, event, message, chatId, result.messageId)
    } else if (messageData.type === 'file') {
      const result = await zApiClient.sendDocument(
        context.instance.instanceId,
        context.instance.zApiToken || '',
        messageData.link || '',
        chatId,
        messageData.name || '',
      )
      log.info(
        {
          domain: event.auth.domain,
          instanceId: context.instance.instanceId,
          chatId,
          zApiMessageId: result.messageId,
        },
        'File message sent via Z-API',
      )
      await persistOutboundMessage(
        instanceDbId,
        result.messageId,
        bitrixMessageId,
        chatId,
        'DOCUMENT',
        undefined,
        messageData.name,
      )
      await setDelivered(bitrixClient, event, message, chatId, result.messageId)
    } else {
      log.warn(
        {
          domain: event.auth.domain,
          instanceId: context.instance.instanceId,
          messageType: messageData.type,
        },
        'Unknown message type — skipping',
      )
    }
  }

  log.info(
    {
      domain: event.auth.domain,
      line: event.data.LINE,
      instanceId: context.instance.instanceId,
      chatId,
      messagesProcessed: messages.length,
    },
    'Bitrix outbound message processing completed',
  )
}

async function setDelivered(
  bitrixClient: BitrixClient,
  event: IBX24MessageEvent,
  message: IBX24MessageEvent['data']['MESSAGES'][number],
  chatId: string,
  zApiMessageId: string,
): Promise<void> {
  await bitrixClient.setMessageDelivered({
    CONNECTOR: env.bitrix.connector.code,
    LINE: event.data.LINE,
    MESSAGES: [
      {
        im: message.im,
        message: { id: zApiMessageId },
        chat: { id: chatId },
      },
    ],
  })
}
