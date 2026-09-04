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
import { ensureBitrixBotId } from '@/modules/thinkzap/application/ensure-bitrix-bot-id'
import { notifyOperatorWindowClosed } from '@/modules/thinkzap/application/notify-operator-window-closed'
import { resolveBitrixReplyContext } from '@/modules/thinkzap/application/resolve-bitrix-reply-context'
import { makeOutboundSenderResolver } from '@/modules/thinkzap/main/make-outbound-sender-resolver'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import {
  findLineItemByChannelId,
  findLineItemByInstanceId,
} from '@/modules/thinkzap/application/helpers/resolve-settings-by-instance-id'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import {
  AppendJobLog,
  noopJobLog,
} from '@/modules/thinkzap/domain/ports/job-log.port'
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

type PersistOutboundMessageInput = {
  instanceId: string
  providerMessageId: string
  bitrixMessageId: string
  /**
   * A identidade do contato — o `chat.id` do evento, usado verbatim como destino no
   * provider.
   *
   * **Não é telefone.** A doc antiga aqui dizia que era "telefone canônico sempre que o
   * contato tem um", e isso deixou de valer: em linha Z-API a identidade passou a ser o
   * LID do contato, porque o `phone` que a Z-API entrega vem ora número, ora `@lid`, e
   * usá-lo como chave abria duas conversas para a mesma pessoa.
   *
   * O que **continua** valendo é a invariante que importa: o valor é o mesmo em todas as
   * direções que escrevem `chat.id`, então a resposta do operador disca o mesmo
   * identificador que o inbound usou. A Z-API aceita um `@lid` no campo `phone` do envio
   * — é o mecanismo documentado por eles.
   *
   * As formas possíveis, todas aceitas pelo provider: LID (Z-API, contato novo),
   * telefone normalizado (Z-API legado, e HubMessage) e jid de grupo.
   */
  chatId: string
  /**
   * Chat do canal aberto (`im.chat_id`), onde o operador escreveu.
   *
   * Passou a ser gravado porque é o único endereço para avisar o operador quando o
   * provider aceita o envio e a Meta o recusa depois — o callback de status conhece a
   * mensagem por `providerMessageId` e precisa daqui o `DIALOG_ID`. Sem isto, a recusa
   * não tem onde aparecer.
   */
  bitrixChatId: string
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
  text?: string
  fileName?: string
}

/**
 * Objeto em vez de sete posicionais: os quatro primeiros campos são todos ids em
 * string, e a ordem deles era a única coisa separando "gravou o chat certo" de "gravou
 * o telefone no lugar do chat".
 */
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
    })
  } catch (err) {
    log.warn(
      {
        instanceId: input.instanceId,
        providerMessageId: input.providerMessageId,
        bitrixMessageId: input.bitrixMessageId,
        err,
        dbWriteFailed: true,
      },
      'Failed to persist outbound message to DB',
    )
  }
}

/** Tipos em que o WhatsApp aceita legenda junto da mídia. */
const CAPTIONABLE_KINDS: ReadonlySet<OutboundMessageDescriptor['kind']> =
  new Set(['image', 'video', 'document'])

/**
 * Converte o evento do Bitrix em descritores neutros de envio. O provider
 * concreto é decidido depois, no resolver — aqui nada sabe de Z-API ou
 * HubMessage.
 *
 * O evento traz `text` e `files` no **mesmo** objeto quando o operador anexa um
 * arquivo e escreve um comentário no mesmo envio. Aqui havia um `return` no
 * primeiro `if (text)`, antes do laço de anexos: o arquivo era descartado em
 * silêncio e o contato recebia só o texto, com o job em `completed` e o Bitrix
 * já confirmado. Por isso os dois são percorridos.
 *
 * Onde o tipo aceita legenda (imagem, vídeo, documento), o texto vira legenda do
 * **primeiro** anexo — uma mensagem só, como o operador vê no Bitrix. Onde não
 * aceita (áudio), sai como texto separado **antes** da mídia, que é a ordem em
 * que o comentário aparece acima do anexo no canal aberto.
 */
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

  // Anexo de tipo desconhecido não leva o texto embora: sem mídia sobrando, o
  // comentário ainda é a mensagem que o operador quis enviar.
  if (!media.length) return text ? [{ kind: 'text', text }] : []

  if (!text) return media

  const first = media[0]

  if (first && CAPTIONABLE_KINDS.has(first.kind)) {
    return [{ ...first, text }, ...media.slice(1)]
  }

  return [{ kind: 'text', text }, ...media]
}

/** Rótulo do descritor para a aba Logs: distingue mídia legendada de mídia crua. */
function describeDescriptor(descriptor: OutboundMessageDescriptor): string {
  return descriptor.kind !== 'text' && descriptor.text
    ? `${descriptor.kind} com legenda`
    : descriptor.kind
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

/**
 * Envia ao contato no WhatsApp a mensagem que o operador escreveu no canal aberto do
 * Bitrix, pelo provider do conector daquela linha.
 *
 * Além do log de processo (stdout → Promtail → Loki), escreve a história desta execução
 * na **aba Logs do job** via `appendJobLog`: é onde quem abre um job específico no Bull
 * Board procura "por que esta mensagem não chegou", sem montar query no Loki. Uma linha
 * por decisão e por desfecho, não por passo — cada chamada é um round-trip ao Redis.
 */
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

  /**
   * Os tipos **depois** da tradução, não os do evento: anexo de tipo desconhecido é
   * descartado no parse, e sem esta linha um job que não enviou nada parece um job que
   * enviou. `nenhum` aqui já é a resposta inteira para "a mensagem não chegou".
   *
   * `com legenda` está aqui porque a linha antiga dizia só `text` quando o operador
   * mandava imagem com comentário — o mesmo log de um envio que era realmente só
   * texto, escondendo o anexo perdido.
   */
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
    /**
     * Ambiguidade de vínculo é dado errado no CRM, não falha técnica: duas linhas
     * ativas dizendo responder pelo mesmo canal aberto. Nomeada aqui porque o
     * "Contexto não encontrado" genérico mandaria o suporte procurar linha que existe.
     */
    if (error instanceof AmbiguousChannelBindingError) {
      log.error(
        {
          domain: event.auth.domain,
          line: event.data.LINE,
          subscriptionItemIds: error.subscriptionItemIds,
        },
        'Canal aberto vinculado a mais de uma linha ativa',
      )
      await appendJobLog(
        `${error.message}. Cada linha sai de um número diferente — enviar pela primeira ` +
          'faria a mensagem sair por um número arbitrário e o contato não receber. ' +
          'Conserto é no CRM: desvincular o canal do item que não deve responder ' +
          '(`ufCrm93Conector` na SPA 1146). Job vai falhar; retentativa cai no mesmo lugar.',
      )
    }
    throw error
  }

  if (!context) {
    log.error(
      { domain: event.auth.domain, line: event.data.LINE },
      'Bitrix webhook context not found',
    )
    await appendJobLog(
      `Contexto do webhook não encontrado (domínio=${event.auth.domain}, linha=${event.data.LINE}). ` +
        'Sem instância/conector não há para onde enviar — job vai falhar.',
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

  await appendJobLog(
    `Contexto resolvido: provider=${provider} | instância=${context.instance.instanceId} | ` +
      `channelId=${context.instance.channelId ?? '—'} | item=${context.subscriptionItemId} | ` +
      `destino(chatId)=${chatId}`,
  )

  /**
   * Linha resolvida **uma vez**, no topo: dá o entitlement e os `settings` na mesma
   * leitura. Antes os settings eram resolvidos lá embaixo, dentro do branch de
   * texto, o que fazia uma segunda leitura do contexto por mensagem de texto.
   */
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

  /**
   * Recusa **visível**, não descarte silencioso: aqui existe um operador no Bitrix
   * esperando que a mensagem saia. Lançar deixa o job falhar e o erro aparecer.
   *
   * Linha não resolvida cai no mesmo caminho: sem item não há assinatura que
   * autorize o envio.
   */
  if (!line || line.entitlement !== 'active') {
    log.error(
      {
        domain: event.auth.domain,
        instanceId: context.instance.instanceId,
        subscriptionItemId: line?.item.id ?? null,
        entitlement: line?.entitlement ?? 'unresolved',
      },
      'Envio recusado: linha sem assinatura ativa',
    )
    await appendJobLog(
      `Envio recusado: linha sem assinatura ativa | item=${line?.item.id ?? 'não resolvido'} | ` +
        `entitlement=${line?.entitlement ?? 'unresolved'}. É assinatura, não falha técnica — ` +
        'retentativa cai no mesmo lugar.',
    )
    throw new Error('Line is not enabled for outbound messages')
  }

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

    /**
     * O texto do operador passa pelo preparo do canal aberto (assinatura etc.);
     * midia e documento seguem com o link cru do Bitrix.
     *
     * A condição é "tem texto", não "é do tipo `text`": a legenda de uma mídia é o
     * mesmo texto do operador e precisa do mesmo prefixo de nome, senão a mesma
     * configuração de linha produziria duas saídas diferentes.
     */
    const toSend = descriptor.text
      ? {
          ...descriptor,
          text: await prepareOpenLineOutboundText({
            text: descriptor.text || '',
            /**
             * Do item da SPA, não de `context.instance.settings`: a coluna do
             * banco não é mais escrita desde que a configuração passou para
             * `ufCrm93Settings`, então ler dela devolveria o valor congelado de
             * antes da migração — o prefixo de nome se comportaria ao contrário
             * do que a tela mostra.
             *
             * Vem da resolução do topo, que já leu o contexto para decidir o
             * entitlement — não há segunda ida ao Bitrix por mensagem.
             */
            settings: line.settings,
            operatorUserId: message.message.user_id,
            appId: context.app.id,
            getBitrixUserDisplayName,
            getAllowedUser,
            /**
             * O prefixo ligado e não aplicado é invisível no texto que sai — e era
             * invisível no log também. Aqui existe uma aba onde o cliente olha:
             * sem esta linha, "liguei o toggle e nada acontece" não tem resposta.
             */
            onPrefixUnresolved: info =>
              appendJobLog(describePrefixUnresolved(info)),
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
      /**
       * A mensagem do erro é o que interessa aqui: `HubMessageApiError` já traz método,
       * URL, status HTTP e corpo da resposta no `message`. É a linha que diz se o
       * provider recusou (4xx com motivo) ou caiu (5xx) — sem ela, a aba mostraria só
       * que o job falhou.
       */
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

    /**
     * **Aceite do provider, não entrega ao contato.** O que houve aqui foi um 2xx na
     * API; ninguém trata callback de status de entrega, então este id é o fim da nossa
     * visibilidade. Job `completed` com esta linha e contato sem a mensagem = investigar
     * do lado do provider, por este `providerMessageId` — não no nosso código.
     */
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
      type: result.persistedType,
      /**
       * Mídia legendada grava aqui a legenda que o adapter devolveu em `sentText`,
       * mantendo `type` da mídia. Mídia sem legenda continua gravando `null`.
       */
      text: result.sentText,
      // Só documento persiste `fileName` — imagem/vídeo/áudio nunca gravaram o
      // nome do arquivo, e nem a extração do adapter nem a legenda mudam isso:
      // quem procura o registro de uma imagem procura por id, não por arquivo.
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
