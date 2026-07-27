import { env } from '@/config/env'
import { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import {
  OutboundMessageDescriptor,
  OutboundSendResult,
} from '@/modules/thinkzap/domain/ports/outbound-message-sender.port'
import { appIdResolver } from '@/modules/auth/presentation/controllers/helpers/app-id-resolver'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { GetBitrixWebhookContextRepository } from '@/modules/thinkzap/domain/repositories/get-bitrix-webhook-context.repository'
import { PrismaBitrixWebhookContextRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-bitrix-webhook-context.repository'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { BitrixGetUserDisplayNameAdapter } from '@/modules/thinkzap/infra/adapters/bitrix-get-user-display-name.adapter'
import { isConversationWindowClosedError } from '@/modules/thinkzap/infra/adapters/is-conversation-window-closed-error'
import { PrismaAllowedUserRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-allowed-user.repository'
import { prepareOpenLineOutboundText } from '@/modules/thinkzap/application/prepare-open-line-outbound-text'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { ensureBitrixBotId } from '@/modules/thinkzap/application/ensure-bitrix-bot-id'
import { notifyOperatorWindowClosed } from '@/modules/thinkzap/application/notify-operator-window-closed'
import { resolveBitrixReplyContext } from '@/modules/thinkzap/application/resolve-bitrix-reply-context'
import { makeOutboundSenderResolver } from '@/modules/thinkzap/main/make-outbound-sender-resolver'
import { redisConnection } from '@/queue/redis-connection'

const log = createWorkerSourceLogger('bitrix')
const messageRepo = new PrismaThinkzapMessageRepository()
const outboundSenderResolver = makeOutboundSenderResolver()

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
  providerMessageId: string,
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
      providerMessageId,
      bitrixMessageId,
      type,
      text: text ?? null,
      fileName: fileName ?? null,
      chatId,
    })
  } catch (err) {
    log.warn(
      {
        instanceId,
        providerMessageId,
        bitrixMessageId,
        err,
        dbWriteFailed: true,
      },
      'Failed to persist outbound message to DB',
    )
  }
}

/**
 * Converte o evento do Bitrix em descritores neutros de envio. O provider
 * concreto é decidido depois, no resolver — aqui nada sabe de Z-API ou
 * HubMessage.
 */
function toOutboundDescriptors(
  message: IBX24MessageEvent['data']['MESSAGES'][number],
  logContext: { domain: string },
): OutboundMessageDescriptor[] {
  if (message.message.text) {
    return [{ kind: 'text', text: message.message.text }]
  }

  if (!message.message.files) return []

  const descriptors: OutboundMessageDescriptor[] = []

  for (const file of message.message.files) {
    const kind = toOutboundKind(file)

    if (!kind) {
      log.warn(
        { domain: logContext.domain, messageType: file.type },
        'Unknown message type — skipping',
      )
      continue
    }

    descriptors.push({
      kind,
      url: file.downloadLink,
      fileName: file.name,
      mime: file.mime,
    })
  }

  return descriptors
}

/** `null` = tipo não suportado; o chamador loga e ignora sem derrubar o job. */
function toOutboundKind(file: {
  name: string
  type: string
}): OutboundMessageDescriptor['kind'] | null {
  // Áudio gravado no Bitrix chega com o nome prefixado, não pelo `type`.
  if (file.name.includes('audio-')) return 'audio'

  switch (file.type) {
    case 'image':
      return 'image'
    case 'video':
      return 'video'
    case 'audio':
      return 'audio'
    case 'file':
      return 'document'
    default:
      return null
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

  const descriptors = toOutboundDescriptors(message, {
    domain: event.auth.domain,
  })

  log.debug(
    {
      domain: event.auth.domain,
      line: event.data.LINE,
      parsedMessages: descriptors.map(d => ({ type: d.kind })),
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

  const provider = context.connector.provider
  const chatId = message.chat.id

  log.debug(
    {
      domain: event.auth.domain,
      instanceId: context.instance.instanceId,
      internalInstanceId: context.instance.id,
      provider,
    },
    'Bitrix webhook context resolved',
  )

  const bitrixClient = new BitrixClient({
    bitrixCredential: context.app.credential,
    domain: context.name,
  })

  const sender = outboundSenderResolver.resolve(provider, {
    instanceId: context.instance.instanceId,
    zApiToken: context.instance.zApiToken,
    channelId: context.instance.channelId,
    chatId,
  })

  const botId = await ensureBitrixBotId(
    bitrixClient,
    redisConnection,
    context.name,
    env.appCodes.thinkzap,
  )
  const response = await bitrixClient.callMethod<BitrixMessageGetResult>(
    'imbot.v2.Chat.Message.get',
    {
      botId,
      messageId: message.im.message_id,
    },
  )

  const replyId = response.result?.message?.params?.REPLY_ID

  // Provider sem suporte a citar mensagem não resolve a referência: evita uma
  // consulta ao banco cujo resultado seria descartado no adapter.
  let referencedMessageId: string | undefined
  if (replyId && !sender.supportsReply) {
    log.debug(
      { domain: event.auth.domain, provider, replyId },
      'Provider não suporta reply — enviando sem citação',
    )
  } else {
    referencedMessageId = await resolveBitrixReplyContext(
      context.instance.id,
      replyId,
      messageRepo,
    )
  }

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

  const bitrixMessageId = message.im.message_id
  const instanceDbId = context.instance.id

  for (const descriptor of descriptors) {
    log.debug(
      {
        domain: event.auth.domain,
        instanceId: context.instance.instanceId,
        chatId,
        provider,
        messageType: descriptor.kind,
      },
      'Sending message to contact',
    )

    // O texto do operador passa pelo preparo do canal aberto (assinatura etc.);
    // midia e documento seguem com o link cru do Bitrix.
    const toSend =
      descriptor.kind === 'text'
        ? {
            ...descriptor,
            text: await prepareOpenLineOutboundText({
              text: descriptor.text || '',
              settings: context.instance.settings,
              operatorUserId: message.message.user_id,
              appId: context.app.id,
              getBitrixUserDisplayName,
              getAllowedUser,
            }),
          }
        : descriptor

    let result: OutboundSendResult
    try {
      result = await sender.send(toSend, { referencedMessageId })
    } catch (err) {
      // Janela de 24h fechada e uma falha permanente: nenhuma retentativa passa,
      // so um template aprovado. Avisa o operador e encerra sem relancar, para o
      // BullMQ nao retentar. Sem persistir e sem confirmar entrega.
      if (isConversationWindowClosedError(err)) {
        log.warn(
          {
            domain: event.auth.domain,
            instanceId: context.instance.instanceId,
            chatId,
            bitrixMessageId,
            conversationWindowClosed: true,
          },
          'HubMessage rejeitou o envio por janela de 24h fechada — avisando operador sem retentar',
        )
        await notifyOperatorWindowClosed(
          bitrixClient,
          botId,
          message.im.chat_id,
        )
        return
      }
      throw err
    }

    log.info(
      {
        domain: event.auth.domain,
        instanceId: context.instance.instanceId,
        chatId,
        provider,
        providerMessageId: result.messageId,
        messageType: result.persistedType,
      },
      'Message sent to contact',
    )

    await persistOutboundMessage(
      instanceDbId,
      result.messageId,
      bitrixMessageId,
      chatId,
      result.persistedType,
      result.sentText,
      // Só documento persiste `fileName` — imagem/vídeo/áudio nunca gravaram o
      // nome do arquivo, e a extração do adapter não muda isso.
      result.persistedType === 'DOCUMENT' ? descriptor.fileName : undefined,
    )
    await setDelivered(bitrixClient, event, message, chatId, result.messageId)
  }

  log.info(
    {
      domain: event.auth.domain,
      line: event.data.LINE,
      instanceId: context.instance.instanceId,
      chatId,
      provider,
      messagesProcessed: descriptors.length,
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
