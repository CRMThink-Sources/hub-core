import {
  deliverBotSpeech,
  notifyBotOutcome,
  type BotDeliveryDeps,
} from '@/modules/thinkzap/application/bot-outbox-effects'
import { PrismaBotFlowBotRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-bot-flow-bot.repository'
import { BitrixBotSessionAdapter } from '@/modules/thinkzap/infra/adapters/bitrix-bot-session.adapter'
import {
  deliverOperatorReply,
  notifyOperatorOutcome,
  notifyOperatorWaiting,
  type OperatorDeliveryDeps,
  type OperatorNoticeDeps,
} from '@/modules/thinkzap/application/operator-outbox-effects'
import { ensureBitrixBotId } from '@/modules/thinkzap/application/ensure-bitrix-bot-id'
import { postOpenChannelSystemNotice } from '@/modules/thinkzap/application/post-open-channel-system-notice'
import { dailyLimitNotices } from '@/modules/thinkzap/domain/daily-limit-notices'
import { settleRobotMessageGroup } from '@/modules/thinkzap/application/settle-robot-message-group'
import { env } from '@/config/env'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { OutboundMediaNotFoundError } from '@/modules/thinkzap/domain/ports/outbound-media-storage.port'
import { makeOutboundMediaStorage } from '@/modules/thinkzap/main/make-outbound-media-storage'
import { settleWidgetAttachmentGroup } from '@/modules/thinkzap/application/settle-widget-attachment-group'
import type { SettledDispatchGroup } from '@/modules/thinkzap/application/dispatch-widget-outbox-message'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { DispatchWidgetOutboxMessage } from '@/modules/thinkzap/application/dispatch-widget-outbox-message'
import {
  describePrefixUnresolved,
  prepareOpenLineOutboundText,
} from '@/modules/thinkzap/application/prepare-open-line-outbound-text'
import { BitrixGetUserDisplayNameAdapter } from '@/modules/thinkzap/infra/adapters/bitrix-get-user-display-name.adapter'
import { PrismaAllowedUserRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-allowed-user.repository'
import type { DispatchLineTarget } from '@/modules/thinkzap/application/dispatch-widget-outbox-message'
import {
  notifyWidgetSendOutcome,
  WidgetSendOutcome,
} from '@/modules/thinkzap/application/notify-widget-send-outcome'
import { makeDailySendQuota } from '@/modules/thinkzap/main/make-daily-send-quota'
import { makeSendCadence } from '@/modules/thinkzap/main/make-send-cadence'
import { makeInstallationLocaleRepository } from '@/modules/thinkzap/main/make-installation-locale'
import { timelineNotices } from '@/modules/thinkzap/domain/notices/timeline-notices'
import { reportSmsMessageStatus } from '@/modules/thinkzap/application/report-sms-message-status'
import {
  resolveLineTarget,
  settleUnresolvedLine,
} from './widget-send-line-target'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { BullMqOpenChannelConversationQueue } from '@/modules/thinkzap/infra/queue/bullmq-open-channel-conversation.queue'
import { acquireDestinationLock } from '@/modules/thinkzap/infra/queue/destination-send-lock'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import {
  PrismaWidgetOutboxRepository,
  WidgetOutboxRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { makeOutboundSenderResolver } from '@/modules/thinkzap/main/make-outbound-sender-resolver'
import { makeTemplateSenderResolver } from '@/modules/thinkzap/main/connector/make-template-sender-resolver'
import { makeInteractiveButtonSenderResolver } from '@/modules/thinkzap/main/connector/make-interactive-button-sender-resolver'
import { AppendJobLog } from '@/modules/thinkzap/domain/ports/job-log.port'
import { ThinkzapWidgetSendJob } from '@/queue/thinkzap-widget-outbound.queue'
import { redisConnection } from '@/queue/redis-connection'
import { BitrixLivefeedNotificationService } from '@/shared/application/send-bitrix-notificatio.service'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { makeBitrixClientByDomainAndAppCoode } from '@/shared/main/make-bitrix-client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'

const log = createWorkerSourceLogger('bitrix')

/**
 * `reschedule` (destino ocupado) e `{ deferUntil }` (cadência ou fora da vez na fila
 * da linha) adiam sem gastar tentativa.
 */
export type WidgetSendJobOutcome =
  | 'done'
  | 'reschedule'
  | { deferUntil: number }

// `reschedule` (destino ocupado) adia sem gastar tentativa: contenção não é falha de envio.
export async function processWidgetSendJob(
  job: ThinkzapWidgetSendJob,
  context: { isLastAttempt: boolean; appendJobLog: AppendJobLog },
): Promise<WidgetSendJobOutcome> {
  const { appendJobLog } = context
  const outbox = new PrismaWidgetOutboxRepository()

  const row = await outbox.findById(job.outboxId)
  if (!row) {
    log.warn(
      { app: 'thinkzap', outboxId: job.outboxId },
      'Intenção de envio não encontrada; job descartado',
    )
    await appendJobLog(
      `Intenção ${job.outboxId} não encontrada no banco. Nada a enviar — job descartado.`,
    )
    return 'done'
  }

  // `attempts` é da intenção, não do job: a row sobrevive ao job.
  log.info(
    {
      app: 'thinkzap',
      outboxId: row.id,
      subscriptionItemId: row.subscriptionItemId,
      destination: row.destination,
      outboxKind: row.kind,
      templateName: row.templateName,
      outboxStatus: row.status,
      alreadyDelivered: row.providerMessageId !== null,
      outboxAttempts: row.attempts,
      lastError: row.lastError,
      isLastAttempt: context.isLastAttempt,
    },
    'Despachando intenção de envio do widget',
  )

  await appendJobLog(
    `Intenção ${row.id} | tipo=${row.kind}` +
      (row.kind === 'TEMPLATE' ? ` (${row.templateName})` : '') +
      (row.kind === 'INTERACTIVE_BUTTON'
        ? ` (${row.buttonPayload?.buttons.length ?? 0} botões)`
        : '') +
      ` | status=${row.status} | destino=${row.destination} | ` +
      `jáEntregue=${row.providerMessageId !== null} | tentativasDaIntenção=${row.attempts}` +
      (context.isLastAttempt ? ' | ÚLTIMA TENTATIVA' : ''),
  )

  const resolution = await resolveLineTarget(row, input =>
    makeGetAplicationContext().execute(input),
  )
  if (resolution.kind !== 'found') {
    return settleUnresolvedLine(row, resolution, context.isLastAttempt, {
      markFailed: (id, reason) => outbox.markFailed(id, reason),
      notifyFailed: () => notifyOutcomeFor(row, 'failed'),
      appendJobLog,
      onUnavailable: (err, willRetry) =>
        logThinkzapError(
          log,
          'thinkzap.outbox.line_lookup_unavailable',
          {
            app: 'thinkzap',
            outboxId: row.id,
            subscriptionItemId: row.subscriptionItemId,
            willRetry,
            err,
          },
          { msg: 'Não foi possível consultar a linha da intenção de envio' },
        ),
    })
  }
  const { line } = resolution

  await appendJobLog(
    `Linha resolvida: provider=${line.provider} | instância=${line.instanceId}`,
  )

  const dispatch = new DispatchWidgetOutboxMessage({
    outbox,
    senderResolver: makeOutboundSenderResolver(),
    templateSenderResolver: makeTemplateSenderResolver(),
    interactiveButtonSenderResolver: makeInteractiveButtonSenderResolver(),
    messages: new PrismaThinkzapMessageRepository(),
    openChannelQueue: new BullMqOpenChannelConversationQueue(),
    acquireLock: (instanceId, destination) =>
      acquireDestinationLock(redisConnection, instanceId, destination),
    quota: makeDailySendQuota(),
    cadence: makeSendCadence(),
    resolveMedia: record => resolveOutboundMedia(record),
    releaseMedia: record => releaseOutboundMedia(record),
    onGroupSettled: settled => settleGroup(settled, line),
    notifyOutcome: (outcome, record) =>
      record.origin === 'OPERATOR'
        ? notifyOperatorOutcome(outcome, record, operatorNoticeDeps(line))
        : record.origin === 'BOT'
          ? notifyBotOutcome(outcome, record)
          : notifyOutcomeFor(record, outcome),
    onDelivered: async (record, providerMessageId) =>
      record.origin === 'BOT'
        ? deliverBotSpeech(record, botDeliveryDeps(record))
        : deliverOperatorReply(
            record,
            providerMessageId,
            operatorDeliveryDeps(record),
          ),
    onCadenceDeferred: (record, deferral) =>
      notifyOperatorWaiting(
        record,
        deferral,
        line.instanceId,
        operatorNoticeDeps(line),
      ),
    notifySent: record => notifySentFor(record),
    // Só rows de campanha chegam aqui (o despacho filtra pelas âncoras).
    reportSmsStatus: async (record, status) => {
      const domainName =
        (await new PrismaDomainRepository().getDomainById(record.domainId))
          ?.name ?? ''

      const bitrix = await makeBitrixClientByDomainAndAppCoode(
        domainName,
        record.appCode,
      )

      await reportSmsMessageStatus(bitrix, {
        senderCode: record.smsSenderCode as string,
        messageId: record.smsMessageId as string,
        status,
      })
    },
    appendJobLog,
    // Mesmo preparo do canal aberto, para "Prefixar nome do operador" valer no widget.
    prepareOutboundText: async input => {
      const bitrix = await makeBitrixClientByDomainAndAppCoode(
        (await new PrismaDomainRepository().getDomainById(row.domainId))
          ?.name ?? '',
        row.appCode,
      )

      return prepareOpenLineOutboundText({
        ...input,
        getBitrixUserDisplayName: new BitrixGetUserDisplayNameAdapter(bitrix),
        getAllowedUser: new PrismaAllowedUserRepository(),
        onPrefixUnresolved: info =>
          appendJobLog(describePrefixUnresolved(info)),
      })
    },
  })

  const result = await dispatch.execute({
    outboxId: row.id,
    line,
    isLastAttempt: context.isLastAttempt,
  })

  log.info(
    {
      app: 'thinkzap',
      outboxId: row.id,
      subscriptionItemId: row.subscriptionItemId,
      dispatchStatus: result.status,
    },
    'Job de envio do widget processado',
  )

  await appendJobLog(`Desfecho: ${describeOutcome(result.status)}`)

  if (result.status === 'locked') return 'reschedule'
  if (result.status === 'deferred') return { deferUntil: result.retryAt }
  return 'done'
}

function describeOutcome(status: string): string {
  const descriptions: Record<string, string> = {
    sent: 'ENTREGUE ao contato nesta execução.',
    resumed:
      'Já estava entregue — o provider NÃO foi chamado de novo; só os efeitos colaterais foram retomados.',
    locked:
      'Destino ocupado por outro envio. Reagendado sem gastar tentativa, para preservar a ordem das mensagens.',
    deferred:
      'Aguardando a cadência da linha (janela cheia, pausa ou outra mensagem à frente na fila). Reagendado sem gastar tentativa.',
    failed:
      'NÃO entregue e não será reenviado automaticamente. Operador avisado na timeline.',
    unknown:
      'INDETERMINADO — não foi possível confirmar se saiu. Não é reenviado de propósito: reenviar arriscaria mensagem duplicada no WhatsApp do contato.',
  }

  return descriptions[status] ?? status
}

// Cliente por domínio/app code: no worker não há `req`.
async function makeNotifier(row: WidgetOutboxRecord) {
  const domain = await new PrismaDomainRepository().getDomainById(row.domainId)
  if (!domain) return null

  const bitrix = await makeBitrixClientByDomainAndAppCoode(
    domain.name,
    row.appCode,
  )

  return new BitrixLivefeedNotificationService(bitrix)
}

async function notifyOutcomeFor(
  row: WidgetOutboxRecord,
  outcome: WidgetSendOutcome,
): Promise<void> {
  try {
    const notifier = await makeNotifier(row)
    if (!notifier) return

    await notifyWidgetSendOutcome(notifier, {
      outcome,
      entity: row.entity,
      entityId: row.entityId,
      destination: row.destination,
      text: row.text,
      // Lido só aqui, quando o comentário vai mesmo sair.
      locale: await makeInstallationLocaleRepository().byInstallation(
        row.domainId,
        row.appCode,
      ),
    })
  } catch (err) {
    logThinkzapError(
      log,
      'thinkzap.message.widget_send_notice_failed',
      { app: 'thinkzap', outboxId: row.id, outcome, err },
      { msg: 'Falha ao montar o cliente Bitrix para avisar o operador' },
    )
  }
}

// A linha `Template:` é por onde o cliente concilia o que a Meta cobrou — não remover.
async function notifySentFor(row: WidgetOutboxRecord): Promise<void> {
  try {
    const notifier = await makeNotifier(row)
    if (!notifier) return

    const locale = await makeInstallationLocaleRepository().byInstallation(
      row.domainId,
      row.appCode,
    )

    await notifier.execute({
      contextId: row.entityId,
      entity: row.entity,
      message: timelineNotices(locale).widgetSentQueued({
        destination: row.destination,
        templateName:
          row.kind === 'TEMPLATE' ? String(row.templateName) : undefined,
        text: row.text,
      }),
    })
  } catch (err) {
    logThinkzapError(
      log,
      'thinkzap.message.widget_send_notice_failed',
      { app: 'thinkzap', outboxId: row.id, err },
      { msg: 'Falha ao publicar o comentário de timeline do envio' },
    )
  }
}

type MediaSource =
  | { kind: 'stored'; key: string; contentType?: string }
  | { kind: 'url'; url: string }

function mediaSourceOf(
  row: Pick<WidgetOutboxRecord, 'id' | 'mediaSource'>,
): MediaSource | null {
  const source = row.mediaSource
  if (source?.kind === 'stored' && typeof source.key === 'string') {
    return {
      kind: 'stored',
      key: source.key,
      contentType:
        typeof source.contentType === 'string' ? source.contentType : undefined,
    }
  }
  if (source?.kind === 'url' && typeof source.url === 'string') {
    return { kind: 'url', url: source.url }
  }
  return null
}

/**
 * O arquivo da parte, obtido agora. Da guarda privada sai como data URL — o sender
 * Z-API já aceita esse formato, e nenhuma URL pública do anexo existe.
 */
async function resolveOutboundMedia(
  row: WidgetOutboxRecord,
): Promise<{ url: string }> {
  const source = mediaSourceOf(row)
  if (!source) throw new OutboundMediaNotFoundError(row.id)
  if (source.kind === 'url') return { url: source.url }

  const storage = makeOutboundMediaStorage()
  if (!storage) throw new OutboundMediaNotFoundError(source.key)
  const media = await storage.load(source.key)
  return {
    url: `data:${source.contentType ?? media.contentType};base64,${media.data.toString('base64')}`,
  }
}

async function releaseOutboundMedia(
  row: Pick<WidgetOutboxRecord, 'id' | 'mediaSource'>,
): Promise<void> {
  const source = mediaSourceOf(row)
  if (source?.kind !== 'stored') return
  try {
    await makeOutboundMediaStorage()?.remove(source.key)
  } catch (err) {
    // A regra de ciclo de vida do bucket recolhe o que sobrar.
    log.warn(
      { app: 'thinkzap', outboxId: row.id, err },
      'Arquivo do anexo não foi apagado depois do envio',
    )
  }
}

async function settleGroup(
  settled: SettledDispatchGroup,
  line: DispatchLineTarget,
): Promise<void> {
  const locale = (record: WidgetOutboxRecord) =>
    makeInstallationLocaleRepository().byInstallation(
      record.domainId,
      record.appCode,
    )

  if (settled.first.origin === 'ROBOT_MESSAGE') {
    await settleRobotMessageGroup(settled, {
      locale,
      postTimeline: async (document, message) => {
        try {
          const notifier = await makeNotifier(settled.first)
          await notifier?.execute({
            contextId: document.entityId,
            entity: document.entity,
            message,
          })
        } catch (err) {
          logThinkzapError(
            log,
            'thinkzap.message.widget_send_notice_failed',
            { app: 'thinkzap', dispatchGroupId: settled.dispatchGroupId, err },
            { msg: 'Falha ao publicar o comentário do robô "Enviar mensagem"' },
          )
        }
      },
    })
    return
  }

  if (settled.first.origin !== 'WIDGET_ATTACHMENT') return

  await settleWidgetAttachmentGroup(settled, {
    openChannelQueue: new BullMqOpenChannelConversationQueue(),
    notifyOutcome: (outcome, record) => notifyOutcomeFor(record, outcome),
    postTimeline: async (record, message) => {
      try {
        const notifier = await makeNotifier(record)
        await notifier?.execute({
          contextId: record.entityId,
          entity: record.entity,
          message,
        })
      } catch (err) {
        logThinkzapError(
          log,
          'thinkzap.message.widget_send_notice_failed',
          { app: 'thinkzap', outboxId: record.id, err },
          {
            msg: 'Falha ao publicar o comentário de timeline do envio com anexo',
          },
        )
      }
    },
    fromPhone: async () => {
      if (line.provider !== ConnectorProvider.ZAPI || !line.zApiToken) return ''
      const phone = await new ZApiClient(
        env.zApi.partnerToken,
        env.zApi.clientToken,
      ).getPhoneData(line.instanceId, line.zApiToken)
      return phone?.phone ?? ''
    },
    locale: record =>
      makeInstallationLocaleRepository().byInstallation(
        record.domainId,
        record.appCode,
      ),
  })
}

async function bitrixFor(
  row: Pick<WidgetOutboxRecord, 'domainId' | 'appCode'>,
) {
  const domain = await new PrismaDomainRepository().getDomainById(row.domainId)
  if (!domain) return null
  const bitrix = await makeBitrixClientByDomainAndAppCoode(
    domain.name,
    row.appCode,
  )
  return { bitrix, domainName: domain.name }
}

function operatorDeliveryDeps(row: WidgetOutboxRecord): OperatorDeliveryDeps {
  const messages = new PrismaThinkzapMessageRepository()
  return {
    persist: async input => {
      await messages.create({ source: 'BITRIX', ...input })
    },
    // A mesma confirmação do envio síncrono: sem ela, a mensagem fica "enviando" no chat.
    setDelivered: async (context, providerMessageId) => {
      const client = await bitrixFor(row)
      await client?.bitrix.setMessageDelivered({
        CONNECTOR: env.bitrix.connector.code,
        LINE: context.line,
        MESSAGES: [
          {
            im: context.im,
            message: { id: providerMessageId },
            chat: { id: context.connectorChatId },
          },
        ],
      })
    },
  }
}

/** Avisos ao operador no chat do canal aberto, pela instalação da row. */
function operatorNoticeDeps(_line: DispatchLineTarget): OperatorNoticeDeps {
  const post = async (row: WidgetOutboxRecord, text: string) => {
    const client = await bitrixFor(row)
    if (!client || !row.bitrixChatId) return false
    const botId = await ensureBitrixBotId(
      client.bitrix,
      redisConnection,
      client.domainName,
      env.appCodes.thinkzap,
    )
    const outcome = await postOpenChannelSystemNotice(client.bitrix, {
      botId,
      bitrixChatId: row.bitrixChatId,
      text,
    })
    return outcome.posted
  }
  const locale = (row: WidgetOutboxRecord) =>
    makeInstallationLocaleRepository().byInstallation(row.domainId, row.appCode)

  return {
    postNotice: post,
    locale,
    notifyDailyLimit: async row => {
      await post(row, dailyLimitNotices(await locale(row)).chat)
    },
    claimOnce: async (key, ttlMs) =>
      (await redisConnection.set(key, '1', 'PX', Math.max(ttlMs, 1), 'NX')) ===
      'OK',
  }
}

/** Eco da fala do bot no chat do canal aberto, pelo próprio bot do fluxo. */
function botDeliveryDeps(row: WidgetOutboxRecord): BotDeliveryDeps {
  return {
    echo: async (context, bitrixChatId, text) => {
      const client = await bitrixFor(row)
      if (!client) return
      const bot = await new PrismaBotFlowBotRepository().getByBitrixBotId(
        context.appId,
        context.bitrixBotId,
      )
      if (!bot) return
      await new BitrixBotSessionAdapter(
        client.bitrix,
        bot.botToken,
        bot.bitrixBotId,
      ).say(bitrixChatId, text)
    },
  }
}
