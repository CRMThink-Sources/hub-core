import { env } from '@/config/env'
import { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import {
  OutboundMessageDescriptor,
  OutboundSendResult,
} from '@/modules/thinkzap/domain/ports/outbound-message-sender.port'
import { resolveByMarketplaceCode } from '@/shared/app-catalog/app-catalog'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  BitrixWebhookContext,
  GetBitrixWebhookContextRepository,
} from '@/modules/thinkzap/domain/repositories/get-bitrix-webhook-context.repository'
import { AmbiguousChannelBindingError } from '@/modules/thinkzap/domain/errors/ambiguous-channel-binding.error'
import { makeBitrixWebhookContextRepository } from '@/modules/thinkzap/main/make-bitrix-webhook-context-repository'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { BitrixGetUserDisplayNameAdapter } from '@/modules/thinkzap/infra/adapters/bitrix-get-user-display-name.adapter'
import { isConversationWindowClosedError } from '@/modules/thinkzap/infra/adapters/is-conversation-window-closed-error'
import { PrismaAllowedUserRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-allowed-user.repository'
import {
  describePrefixUnresolved,
  prepareOpenLineOutboundText,
} from '@/modules/thinkzap/application/prepare-open-line-outbound-text'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import {
  ensureBitrixBotId,
  invalidateBitrixBotId,
  isBotNotFoundError,
} from '@/modules/thinkzap/application/ensure-bitrix-bot-id'
import { notifyOperatorWindowClosed } from '@/modules/thinkzap/application/notify-operator-window-closed'
import { notifyOperatorDailyLimitReached } from '@/modules/thinkzap/application/notify-operator-daily-limit-reached'
import {
  dailyLimitPolicyOf,
  isDailyLimitReachedError,
  sendWithinDailyQuota,
} from '@/modules/thinkzap/application/helpers/send-within-daily-quota'
import { buildCaptionedParts } from '@/modules/thinkzap/application/helpers/build-captioned-parts'
import type { DailyLimitPolicy } from '@/modules/thinkzap/domain/daily-send-limit'
import { makeDailySendQuota } from '@/modules/thinkzap/main/make-daily-send-quota'
import { makeInstallationLocaleRepository } from '@/modules/thinkzap/main/make-installation-locale'
import { openChannelNotices } from '@/modules/thinkzap/domain/notices/open-channel-notices'
import { resolveBitrixReplyContext } from '@/modules/thinkzap/application/resolve-bitrix-reply-context'
import { makeOutboundSenderResolver } from '@/modules/thinkzap/main/make-outbound-sender-resolver'
import { makeInteractiveButtonSenderResolver } from '@/modules/thinkzap/main/connector/make-interactive-button-sender-resolver'
import {
  isButtonActionCode,
  decodeButtonActionCode,
} from '@/modules/thinkzap/application/parse-button-action-code'
import { assertValidButtonsForProvider } from '@/modules/thinkzap/domain/ports/interactive-button-validation'
import { notifyOperatorButtonActionFailed } from '@/modules/thinkzap/application/notify-operator-button-action-failed'
import type { InteractiveButtonSendResult } from '@/modules/thinkzap/domain/ports/interactive-button-sender.port'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import {
  findLineItemByChannelId,
  findLineItemByInstanceId,
} from '@/modules/thinkzap/application/helpers/resolve-settings-by-instance-id'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import {
  logThinkzapError,
  thinkzapError,
} from '@/modules/thinkzap/errors/catalog'
import {
  AppendJobLog,
  noopJobLog,
} from '@/modules/thinkzap/domain/ports/job-log.port'
import { redisConnection } from '@/queue/redis-connection'
import { captureOperatorOAuthFromEvent } from '@/modules/thinkzap/application/capture-operator-oauth-from-event'
import { UpsertOperatorBitrixOAuth } from '@/modules/thinkzap/application/upsert-operator-bitrix-oauth'
import { PrismaThinkzapOperatorOAuthRepository } from '@/modules/thinkzap/infra/persistence/prisma-thinkzap-operator-oauth.repository'
import {
  findMirroredDeviceMessage,
  MirroredMessageReservations,
} from '@/modules/thinkzap/infra/cache/mirrored-message-reservations'

const log = createWorkerSourceLogger('bitrix')
const messageRepo = new PrismaThinkzapMessageRepository()
const mirroredReservations = new MirroredMessageReservations(redisConnection)
const upsertOperatorOAuth = new UpsertOperatorBitrixOAuth(
  new PrismaThinkzapOperatorOAuthRepository(),
)
const outboundSenderResolver = makeOutboundSenderResolver()
const interactiveButtonSenderResolver = makeInteractiveButtonSenderResolver()
const dailySendQuota = makeDailySendQuota()
const installationLocales = makeInstallationLocaleRepository()

/**
 * Recusa por limite diário: permanente até a virada do dia (ou liberação), então
 * avisa o operador e encerra **sem relançar** — retentar cairia no mesmo limite e
 * não há `setDelivered`, porque nada saiu.
 */
async function handleDailyLimitReached(params: {
  logContext: Record<string, unknown>
  bitrixClient: BitrixClient
  botId: number
  bitrixChatId: string
  /** `core_apps.id`: o aviso sai no idioma escolhido no app para a instalação. */
  appId: string
  appendJobLog: AppendJobLog
}): Promise<void> {
  logThinkzapError(
    log,
    'thinkzap.line.daily_limit_reached',
    params.logContext,
    {
      level: 'warn',
      msg: 'Envio do operador recusado pelo limite diário da linha',
    },
  )
  await params.appendJobLog(
    'Envio recusado: a linha atingiu o limite diário de mensagens. Nada foi enviado ao ' +
      'provider — job encerrado SEM retentativa.',
  )
  const locale = await installationLocales.byAppId(params.appId)
  const notice = await notifyOperatorDailyLimitReached(
    params.bitrixClient,
    params.botId,
    params.bitrixChatId,
    locale,
  )
  // O desfecho do aviso vai para a aba Logs: sem isto, "não apareceu no chat" só se
  // descobre no log do container.
  await params.appendJobLog(
    notice.posted
      ? `Operador avisado no chat (mensagem de sistema via ${notice.method}, id=${notice.bitrixMessageId}, idioma=${locale}).`
      : `Aviso ao operador NÃO postado — o Bitrix recusou todas as tentativas: ${notice.reason}`,
  )
}

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

type PersistOutboundMessageInput = {
  instanceId: string
  providerMessageId: string
  bitrixMessageId: string
  // `chat.id` do evento, verbatim: não é telefone (pode ser LID, telefone ou jid de grupo);
  // é o mesmo valor que o inbound usa, então a resposta disca o mesmo destino.
  chatId: string
  // Único endereço (DIALOG_ID) para avisar o operador quando a Meta recusa após o aceite.
  bitrixChatId: string
  // Quem respondeu (`message.user_id`): é o "operador da sessão" do espelhamento.
  bitrixUserId: string
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'INTERACTIVE_BUTTON'
  text?: string
  fileName?: string
}

// Objeto em vez de posicionais: vários ids em string, fácil trocar a ordem sem o tipo acusar.
async function persistOutboundMessage(
  input: PersistOutboundMessageInput,
): Promise<void> {
  try {
    await messageRepo.create({
      instanceId: input.instanceId,
      source: 'BITRIX',
      providerMessageId: input.providerMessageId,
      bitrixMessageId: input.bitrixMessageId,
      bitrixChatId: input.bitrixChatId,
      type: input.type,
      text: input.text ?? null,
      fileName: input.fileName ?? null,
      chatId: input.chatId,
      bitrixUserId: input.bitrixUserId,
    })
  } catch (err) {
    logThinkzapError(log, 'thinkzap.message.outbound_persist_failed', {
      instanceId: input.instanceId,
      providerMessageId: input.providerMessageId,
      bitrixMessageId: input.bitrixMessageId,
      err,
      dbWriteFailed: true,
    })
  }
}

// `text` e `files` podem vir juntos: a regra de legenda está em `buildCaptionedParts`.
function toOutboundDescriptors(
  message: IBX24MessageEvent['data']['MESSAGES'][number],
  logContext: { domain: string },
): OutboundMessageDescriptor[] {
  const text = message.message.text
  const media: OutboundMessageDescriptor[] = []

  for (const file of message.message.files ?? []) {
    const kind = toOutboundKind(file)

    if (!kind) {
      log.warn(
        { domain: logContext.domain, messageType: file.type },
        'Unknown message type — skipping',
      )
      continue
    }

    media.push({
      kind,
      url: file.downloadLink,
      fileName: file.name,
      mime: file.mime,
    })
  }

  // Anexo desconhecido descartado não pode levar o texto embora.
  return buildCaptionedParts(text, media)
}

function describeDescriptor(descriptor: OutboundMessageDescriptor): string {
  return descriptor.kind !== 'text' && descriptor.text
    ? `${descriptor.kind} com legenda`
    : descriptor.kind
}

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

// appendJobLog: uma linha por decisão/desfecho, não por passo — cada chamada vai ao Redis.
export async function processBitrixReceivedMessage(
  event: IBX24MessageEvent,
  deps: { appendJobLog: AppendJobLog } = { appendJobLog: noopJobLog },
): Promise<void> {
  const { appendJobLog } = deps

  log.info(
    {
      domain: event.auth.domain,
      line: event.data.LINE,
      messagesCount: event.data.MESSAGES.length,
    },
    'Processing Bitrix outbound message',
  )

  await appendJobLog(
    `Saída do Bitrix | domínio=${event.auth.domain} | linha=${event.data.LINE} | ` +
      `mensagens no evento=${event.data.MESSAGES.length}`,
  )

  if (!event.data.MESSAGES.length) {
    log.warn(
      { domain: event.auth.domain, line: event.data.LINE },
      'Bitrix event received with no messages — skipping',
    )
    await appendJobLog(
      'Evento sem mensagens — nada a enviar. Job encerrado sem falha.',
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
      parsedMessages: descriptors.map(d => ({
        type: d.kind,
        captioned: d.kind !== 'text' && !!d.text,
      })),
    },
    'Bitrix messages parsed',
  )

  // Tipos após o parse (anexo desconhecido já descartado), não os do evento.
  await appendJobLog(
    `Conteúdo a enviar: ${
      descriptors.map(describeDescriptor).join(', ') ||
      'nenhum (tipo de anexo não suportado — descartado no parse)'
    }`,
  )

  const bitrixWebhookContextRepo: GetBitrixWebhookContextRepository =
    makeBitrixWebhookContextRepository()

  let context: BitrixWebhookContext | null
  try {
    context = await bitrixWebhookContextRepo.getContext({
      domainName: event.auth.domain,
      appCode: resolveByMarketplaceCode(env.appCodes.thinkzap)?.appCodeId ?? '',
      line: event.data.LINE,
    })
  } catch (error) {
    // Dado errado no CRM (duas linhas ativas no mesmo canal), não "contexto ausente".
    if (error instanceof AmbiguousChannelBindingError) {
      logThinkzapError(
        log,
        'thinkzap.line.channel_binding_ambiguous',
        {
          domain: event.auth.domain,
          line: event.data.LINE,
          subscriptionItemIds: error.subscriptionItemIds,
        },
        {
          level: 'error',
          msg: 'Canal aberto vinculado a mais de uma linha ativa',
        },
      )
      await appendJobLog(
        `${error.message}. Cada linha sai de um número diferente — enviar pela primeira ` +
          'faria a mensagem sair por um número arbitrário e o contato não receber. ' +
          'Conserto é no CRM: desvincular o canal do item que não deve responder ' +
          '(`ufCrm93Conector` na SPA 1146). Job vai falhar; retentativa cai no mesmo lugar.',
      )
      throw thinkzapError('thinkzap.line.channel_binding_ambiguous', error)
    }
    throw error
  }

  if (!context) {
    logThinkzapError(
      log,
      'thinkzap.message.outbound_context_missing',
      { domain: event.auth.domain, line: event.data.LINE },
      { level: 'error' },
    )
    await appendJobLog(
      `Contexto do webhook não encontrado (domínio=${event.auth.domain}, linha=${event.data.LINE}). ` +
        'Sem instância/conector não há para onde enviar — job vai falhar.',
    )
    throw thinkzapError('thinkzap.message.outbound_context_missing')
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

  await appendJobLog(
    `Contexto resolvido: provider=${provider} | instância=${context.instance.instanceId} | ` +
      `channelId=${context.instance.channelId ?? '—'} | item=${context.subscriptionItemId} | ` +
      `destino(chatId)=${chatId}`,
  )

  // Token do operador para o espelhamento postar como ele; só complementa o OAuth dos widgets.
  const operatorOAuth = await captureOperatorOAuthFromEvent(
    upsertOperatorOAuth,
    {
      appId: context.app.id,
      auth: event.auth,
      messageUserId: message.message.user_id,
    },
  )
  await appendJobLog(
    operatorOAuth.captured
      ? `Token do operador ${operatorOAuth.bitrixUserId} atualizado a partir do evento.`
      : `Token do operador não atualizado pelo evento: ${operatorOAuth.reason}.`,
  )

  // Resolvida uma vez: entitlement e settings na mesma leitura.
  const appCode =
    resolveByMarketplaceCode(env.appCodes.thinkzap)?.appCodeId ?? ''
  const line =
    provider === ConnectorProvider.HUBMESSAGE
      ? await findLineItemByChannelId(
          {
            channelId: context.instance.channelId ?? '',
            domainId: context.id,
            appCode,
          },
          makeGetAplicationContext(),
        )
      : await findLineItemByInstanceId(
          {
            instanceId: context.instance.instanceId,
            domainId: context.id,
            appCode,
          },
          makeGetAplicationContext(),
        )

  // Lança em vez de descartar: há um operador esperando, a falha precisa aparecer.
  if (!line || line.entitlement !== 'active') {
    logThinkzapError(
      log,
      'thinkzap.line.blocked',
      {
        domain: event.auth.domain,
        instanceId: context.instance.instanceId,
        subscriptionItemId: line?.item.id ?? null,
        entitlement: line?.entitlement ?? 'unresolved',
      },
      { level: 'error', msg: 'Envio recusado: linha sem assinatura ativa' },
    )
    await appendJobLog(
      `Envio recusado: linha sem assinatura ativa | item=${line?.item.id ?? 'não resolvido'} | ` +
        `entitlement=${line?.entitlement ?? 'unresolved'}. É assinatura, não falha técnica — ` +
        'retentativa cai no mesmo lugar.',
    )
    throw thinkzapError('thinkzap.line.blocked')
  }

  // Settings do item (via contexto da aplicação), não os congelados do contexto do webhook.
  const dailyLimitPolicy = dailyLimitPolicyOf({
    provider,
    lineKey: context.instance.instanceId,
    settings: line.settings,
  })

  const bitrixClient = new BitrixClient({
    bitrixCredential: context.app.credential,
    domain: context.name,
  })

  // Cópia que o espelhamento postou como operador: já está no WhatsApp (saiu do aparelho).
  // Só Z-API tem espelhamento; a linha oficial não paga a consulta.
  const mirrored =
    provider === ConnectorProvider.HUBMESSAGE
      ? null
      : await findMirroredCopy(event, message, context.instance.id)
  if (mirrored) {
    await appendJobLog(
      `Mensagem espelhada do aparelho (identificada por ${mirrored.via}) — já está no ` +
        'WhatsApp do contato; NÃO reenviada. Job encerrado sem falha.',
    )
    if (mirrored.providerMessageId) {
      await setDelivered(
        bitrixClient,
        event,
        message,
        chatId,
        mirrored.providerMessageId,
      )
    }
    return
  }

  let botId = await ensureBitrixBotId(
    bitrixClient,
    redisConnection,
    context.name,
    env.appCodes.thinkzap,
  )

  // A tela de botões não conhece o provider, então posta um código como o operador;
  // interceptado aqui, onde provider e destino já estão resolvidos.
  if (isButtonActionCode(message.message.text ?? '')) {
    await sendButtonActionMessage({
      event,
      message,
      context,
      provider,
      chatId,
      botId,
      bitrixClient,
      appendJobLog,
      dailyLimitPolicy,
    })
    return
  }

  const sender = outboundSenderResolver.resolve(provider, {
    instanceId: context.instance.instanceId,
    zApiToken: context.instance.zApiToken,
    channelId: context.instance.channelId,
    chatId,
  })

  const getBitrixMessage = (id: number) =>
    bitrixClient.callMethod<BitrixMessageGetResult>(
      'imbot.v2.Chat.Message.get',
      {
        botId: id,
        messageId: message.im.message_id,
      },
    )

  let response: BitrixMessageGetResult
  try {
    response = await getBitrixMessage(botId)
  } catch (err) {
    if (!isBotNotFoundError(err)) throw err

    // Bot cacheado foi removido do portal: sem invalidar, toda retentativa lê o
    // mesmo id do cache e o envio fica quebrado até a chave expirar. Nada foi
    // enviado ao contato ainda, então repetir a leitura é seguro.
    logThinkzapError(
      log,
      'thinkzap.bitrix.bot_id_failed',
      {
        domain: event.auth.domain,
        staleBotId: botId,
        botNotFound: true,
      },
      {
        level: 'warn',
        msg: 'Cached bot not found in Bitrix — invalidating cache and resolving again',
      },
    )
    await appendJobLog(
      `Bot ${botId} não existe mais no portal (BOT_NOT_FOUND). Cache descartado; ` +
        'resolvendo/registrando o bot de novo.',
    )
    await invalidateBitrixBotId(
      redisConnection,
      context.name,
      env.appCodes.thinkzap,
    )
    botId = await ensureBitrixBotId(
      bitrixClient,
      redisConnection,
      context.name,
      env.appCodes.thinkzap,
    )
    response = await getBitrixMessage(botId)
  }

  const replyId = response.result?.message?.params?.REPLY_ID

  // Sem suporte a reply, pula a consulta ao banco que o adapter descartaria.
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

  for (const [index, descriptor] of descriptors.entries()) {
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

    await appendJobLog(
      `Enviando ${index + 1}/${descriptors.length} via ${provider} | tipo=${describeDescriptor(descriptor)}` +
        (descriptor.fileName ? ` | arquivo=${descriptor.fileName}` : '') +
        (replyId
          ? ` | reply=${referencedMessageId ? 'resolvido' : 'não resolvido/não suportado'}`
          : ''),
    )

    // "Tem texto", não "é text": a legenda também precisa do prefixo de nome.
    const toSend = descriptor.text
      ? {
          ...descriptor,
          text: await prepareOpenLineOutboundText({
            text: descriptor.text || '',
            // Do item da SPA: `context.instance.settings` não é mais escrito (valor congelado).
            settings: line.settings,
            operatorUserId: message.message.user_id,
            appId: context.app.id,
            getBitrixUserDisplayName,
            getAllowedUser,
            onPrefixUnresolved: info =>
              appendJobLog(describePrefixUnresolved(info)),
          }),
        }
      : descriptor

    let result: OutboundSendResult
    try {
      result = await sendWithinDailyQuota(
        dailySendQuota,
        dailyLimitPolicy,
        () => sender.send(toSend, { referencedMessageId }),
      )
    } catch (err) {
      if (isDailyLimitReachedError(err)) {
        await handleDailyLimitReached({
          logContext: {
            domain: event.auth.domain,
            instanceId: context.instance.instanceId,
            chatId,
            bitrixMessageId,
          },
          bitrixClient,
          botId,
          bitrixChatId: message.im.chat_id,
          appId: context.app.id,
          appendJobLog,
        })
        return
      }
      // Janela de 24h fechada é permanente: avisa o operador e não relança (sem retentativa).
      if (isConversationWindowClosedError(err)) {
        logThinkzapError(
          log,
          'thinkzap.hubmessage.window_closed',
          {
            domain: event.auth.domain,
            instanceId: context.instance.instanceId,
            chatId,
            bitrixMessageId,
            conversationWindowClosed: true,
          },
          {
            level: 'warn',
            msg: 'HubMessage rejeitou o envio por janela de 24h fechada — avisando operador sem retentar',
          },
        )
        await appendJobLog(
          'Provider recusou: janela de conversa de 24h fechada. Só template aprovado reabre — ' +
            'operador avisado no chat, job encerrado SEM retentativa e sem entrega.',
        )
        await notifyOperatorWindowClosed(
          bitrixClient,
          botId,
          message.im.chat_id,
          await installationLocales.byAppId(context.app.id),
        )
        return
      }
      logThinkzapError(
        log,
        'thinkzap.hubmessage.send_failed',
        {
          domain: event.auth.domain,
          instanceId: context.instance.instanceId,
          chatId,
          bitrixMessageId,
          provider,
          err,
        },
        { level: 'error' },
      )
      // `HubMessageApiError.message` já traz método, URL, status e corpo da resposta.
      await appendJobLog(
        `Falha no envio via ${provider}: ${err instanceof Error ? err.message : String(err)}. ` +
          'Job vai falhar — BullMQ retenta conforme as tentativas configuradas.',
      )
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

    await appendJobLog(
      `${provider} aceitou (HTTP 2xx): providerMessageId=${result.messageId} | ` +
        `tipoPersistido=${result.persistedType}. Aceite ≠ entrega — não há callback de ` +
        'status; rastrear por este id no provider.',
    )

    await persistOutboundMessage({
      instanceId: instanceDbId,
      providerMessageId: result.messageId,
      bitrixMessageId,
      chatId,
      bitrixChatId: message.im.chat_id,
      bitrixUserId: String(message.message.user_id),
      type: result.persistedType,
      text: result.sentText,
      fileName:
        result.persistedType === 'DOCUMENT' ? descriptor.fileName : undefined,
    })
    await setDelivered(bitrixClient, event, message, chatId, result.messageId)

    await appendJobLog(
      `Persistido no banco e confirmado no Bitrix (setMessageDelivered) | ` +
        `bitrixMessageId=${bitrixMessageId} → ${result.messageId}`,
    )
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

  await appendJobLog(
    `Desfecho: ${descriptors.length} mensagem(ns) aceita(s) pelo ${provider} e confirmada(s) no Bitrix.`,
  )
}

// Código malformado, botão inválido e janela fechada são permanentes: avisa o operador e não relança.
async function sendButtonActionMessage(params: {
  event: IBX24MessageEvent
  message: IBX24MessageEvent['data']['MESSAGES'][number]
  context: BitrixWebhookContext
  provider: ConnectorProvider
  chatId: string
  botId: number
  bitrixClient: BitrixClient
  appendJobLog: AppendJobLog
  dailyLimitPolicy: DailyLimitPolicy | null
}): Promise<void> {
  const {
    event,
    message,
    context,
    provider,
    chatId,
    botId,
    bitrixClient,
    appendJobLog,
    dailyLimitPolicy,
  } = params

  const logContext = {
    domain: event.auth.domain,
    instanceId: context.instance.instanceId,
    chatId,
    provider,
    bitrixMessageId: message.im.message_id,
  }

  const descriptor = decodeButtonActionCode(message.message.text ?? '')

  if (!descriptor) {
    logThinkzapError(
      log,
      'thinkzap.message.button_action_failed',
      { ...logContext, reason: 'malformed-code' },
      {
        level: 'error',
        msg: 'Código de envio de botões malformado — nada foi enviado ao contato',
      },
    )
    await appendJobLog(
      'Código de botões da tela do canal aberto não pôde ser decodificado. ' +
        'Nada foi enviado ao contato. Job encerrado SEM retentativa — o motivo é permanente.',
    )
    const locale = await installationLocales.byAppId(context.app.id)
    await notifyOperatorButtonActionFailed(
      bitrixClient,
      botId,
      message.im.chat_id,
      openChannelNotices(locale).buttonCodeCorrupted,
      locale,
    )
    return
  }

  await appendJobLog(
    `Código de botões decodificado: ${descriptor.buttons.length} botão(ões).`,
  )

  try {
    assertValidButtonsForProvider(provider, descriptor.buttons)
  } catch (err) {
    logThinkzapError(
      log,
      'thinkzap.message.button_action_failed',
      { ...logContext, reason: 'invalid-button-type', err },
      {
        level: 'warn',
        msg: 'Tipo de botão não aceito pelo provider da linha — nada foi enviado',
      },
    )
    await appendJobLog(
      `Tipo de botão inválido para ${provider}: ${(err as Error).message}. ` +
        'Nada foi enviado ao contato. Job encerrado SEM retentativa.',
    )
    await notifyOperatorButtonActionFailed(
      bitrixClient,
      botId,
      message.im.chat_id,
      (err as Error).message,
      await installationLocales.byAppId(context.app.id),
    )
    return
  }

  const sender = interactiveButtonSenderResolver.resolve(provider, {
    channelId: context.instance.channelId ?? undefined,
    instanceId: context.instance.instanceId,
    instanceToken: context.instance.zApiToken ?? undefined,
    recipientIdentifier: chatId,
  })

  let result: InteractiveButtonSendResult
  try {
    result = await sendWithinDailyQuota(dailySendQuota, dailyLimitPolicy, () =>
      sender.send(descriptor),
    )
  } catch (err) {
    if (isDailyLimitReachedError(err)) {
      await handleDailyLimitReached({
        logContext,
        bitrixClient,
        botId,
        bitrixChatId: message.im.chat_id,
        appId: context.app.id,
        appendJobLog,
      })
      return
    }

    if (isConversationWindowClosedError(err)) {
      logThinkzapError(
        log,
        'thinkzap.hubmessage.window_closed',
        { ...logContext, conversationWindowClosed: true },
        {
          level: 'warn',
          msg: 'HubMessage rejeitou o envio de botões por janela de 24h fechada — avisando operador sem retentar',
        },
      )
      await appendJobLog(
        'Provider recusou: janela de conversa de 24h fechada. Só template aprovado reabre — ' +
          'operador avisado no chat, job encerrado SEM retentativa e sem entrega.',
      )
      await notifyOperatorWindowClosed(
        bitrixClient,
        botId,
        message.im.chat_id,
        await installationLocales.byAppId(context.app.id),
      )
      return
    }

    logThinkzapError(
      log,
      'thinkzap.hubmessage.send_failed',
      { ...logContext, err },
      { level: 'error' },
    )
    await appendJobLog(
      `Falha no envio de botões via ${provider}: ${err instanceof Error ? err.message : String(err)}. ` +
        'Job vai falhar — BullMQ retenta conforme as tentativas configuradas.',
    )
    throw err
  }

  log.info(
    { ...logContext, providerMessageId: result.messageId },
    'Button action message sent to contact',
  )

  await appendJobLog(
    `${provider} aceitou os botões (HTTP 2xx): providerMessageId=${result.messageId}. ` +
      'Aceite ≠ entrega — não há callback de status; rastrear por este id no provider.',
  )

  await persistOutboundMessage({
    instanceId: context.instance.id,
    providerMessageId: result.messageId,
    bitrixMessageId: message.im.message_id,
    chatId,
    bitrixChatId: message.im.chat_id,
    bitrixUserId: String(message.message.user_id),
    type: 'INTERACTIVE_BUTTON',
    text: descriptor.body,
  })

  await setDelivered(bitrixClient, event, message, chatId, result.messageId)

  await appendJobLog(
    `Persistido no banco e confirmado no Bitrix (setMessageDelivered) | ` +
      `bitrixMessageId=${message.im.message_id} → ${result.messageId}`,
  )
}

/**
 * A cópia de uma mensagem do aparelho que o espelhamento postou como operador: pela
 * reserva no Redis e, se ela já expirou ou o Redis falhou, pela row `ZAPI` com este
 * `bitrixMessageId`. `null` é resposta de operador, que segue para o envio.
 *
 * Falha do Redis não lança: a resposta do operador não pode ficar presa nele, e a row
 * ainda cobre a cópia gravada a tempo.
 */
async function findMirroredCopy(
  event: IBX24MessageEvent,
  message: IBX24MessageEvent['data']['MESSAGES'][number],
  instanceDbId: string,
): Promise<{ via: string; providerMessageId: string | null } | null> {
  const bitrixMessageId = String(message.im.message_id)

  try {
    const reserved = await findMirroredDeviceMessage(mirroredReservations, {
      domain: event.auth.domain,
      bitrixChatId: String(message.im.chat_id),
      bitrixMessageId,
    })
    if (reserved) return { via: 'reserva', providerMessageId: reserved }
  } catch (err) {
    log.warn(
      { domain: event.auth.domain, bitrixMessageId, err },
      'Falha ao consultar a reserva do espelhamento — seguindo pela row',
    )
  }

  const record = await messageRepo.findByBitrixMessageId(
    instanceDbId,
    bitrixMessageId,
  )
  return record?.source === 'ZAPI'
    ? { via: 'registro', providerMessageId: record.providerMessageId }
    : null
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
