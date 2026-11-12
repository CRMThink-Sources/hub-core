import { dailyLimitNotices } from '@/modules/thinkzap/domain/daily-limit-notices'
import {
  DEFAULT_NOTICE_LOCALE,
  NoticeLocale,
} from '@/modules/thinkzap/domain/notices/notice-locale'
import {
  SendRobotFileFailure,
  timelineNotices,
} from '@/modules/thinkzap/domain/notices/timeline-notices'
import type { OpenChannelConversationQueue } from '@/modules/thinkzap/domain/ports/open-channel-queue.port'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { apiLogger } from '@/shared/infra/logger'
import {
  DAILY_LIMIT_FAILURE,
  SettledDispatchGroup,
} from './dispatch-widget-outbox-message'
import type { RobotMessageGroupMeta } from './enqueue-robot-message'
import { resolveOpenChannelText } from './helpers/describe-attachment-text'
import type { WidgetAttachmentKind } from './send-widget-message.types'

export type SettleRobotMessageGroupDeps = {
  /** Comentário na timeline do documento. Nunca lança. */
  postTimeline: (
    document: { entity: string; entityId: string },
    message: string,
  ) => Promise<void>
  locale: (row: WidgetOutboxRecord) => Promise<NoticeLocale>
  /** Abre a conversa no canal aberto, como o envio pelo CRM faz. */
  openChannelQueue: OpenChannelConversationQueue
}

/** Tipo persistido da mídia → o descritivo que o histórico usa (`document` = arquivo). */
const ATTACHMENT_KIND_BY_MEDIA: Record<
  NonNullable<WidgetOutboxRecord['mediaType']>,
  WidgetAttachmentKind
> = { image: 'image', video: 'video', audio: 'audio', document: 'file' }

/**
 * A conversa do canal aberto, **uma por destinatário** que recebeu alguma parte — o que o
 * envio pelo CRM já faz. Sem isto o contato respondia e o Bitrix abria o chat só na
 * resposta, sem a mensagem da automação no histórico.
 *
 * Ancorada na primeira parte entregue do destinatário (é por ela que `chat_id` é gravado).
 * Nunca lança: o envio já saiu e a timeline ainda precisa ser publicada.
 */
async function openConversations(
  settled: SettledDispatchGroup,
  meta: RobotMessageGroupMeta,
  deps: SettleRobotMessageGroupDeps,
): Promise<void> {
  const { first } = settled
  const locale = await deps.locale(first).catch(() => DEFAULT_NOTICE_LOCALE)

  for (const destination of meta.recipients) {
    const delivered = settled.parts.filter(
      part =>
        part.destination === destination &&
        part.status === 'SENT' &&
        part.providerMessageId,
    )
    const anchor = delivered[0]?.providerMessageId
    if (!anchor) continue

    const firstMedia = delivered.find(part => part.mediaType)?.mediaType
    const text = resolveOpenChannelText(
      meta.message,
      firstMedia ? [ATTACHMENT_KIND_BY_MEDIA[firstMedia]] : [],
      locale,
    )
    if (!text) continue

    try {
      await deps.openChannelQueue.enqueue({
        subscriptionItemId: first.subscriptionItemId,
        domainId: first.domainId,
        appCode: first.appCode,
        instanceId: first.instanceId,
        providerMessageId: anchor,
        destination,
        text,
        entity: first.entity,
        entityId: first.entityId,
        sentBy: 'automation',
      })
    } catch (err) {
      apiLogger.error(
        {
          app: 'thinkzap',
          dispatchGroupId: settled.dispatchGroupId,
          destination,
          err,
        },
        'Não foi possível enfileirar a abertura da conversa do robô; envio preservado',
      )
    }
  }
}

function isRobotMeta(value: unknown): value is RobotMessageGroupMeta {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'robot-message'
  )
}

/**
 * O comentário do robô "Enviar mensagem", **uma vez**, quando todas as partes de
 * todos os destinatários terminaram — o mesmo texto que o disparo síncrono deixava
 * no fim do request:
 *
 * - enviado: destinatário com alguma parte entregue e nenhuma recusada pelo limite;
 * - não atendido por limite diário: destinatário com alguma parte recusada por ele;
 * - arquivos enviados (aceitos para algum destinatário) e não enviados (descartados
 *   antes do envio, ou recusados pelo provider para todos).
 */
export async function settleRobotMessageGroup(
  settled: SettledDispatchGroup,
  deps: SettleRobotMessageGroupDeps,
): Promise<void> {
  const meta = settled.first.dispatchMeta
  if (!isRobotMeta(meta)) return

  const refused = new Set<string>()
  const delivered = new Set<string>()
  const acceptedFiles = new Set<string>()
  const providerFailedFiles = new Set<string>()

  for (const part of settled.parts) {
    if (part.status === 'FAILED' && part.lastError === DAILY_LIMIT_FAILURE) {
      refused.add(part.destination)
      continue
    }
    if (part.status === 'SENT') {
      delivered.add(part.destination)
      if (part.kind === 'MEDIA' && part.fileName) {
        acceptedFiles.add(part.fileName)
      }
      continue
    }
    if (part.kind === 'MEDIA' && part.fileName) {
      providerFailedFiles.add(part.fileName)
    }
  }

  const sent = meta.recipients.filter(
    phone => delivered.has(phone) && !refused.has(phone),
  )
  const refusedByLimit = meta.recipients.filter(phone => refused.has(phone))

  if (refusedByLimit.length > 0) {
    logThinkzapError(
      apiLogger,
      'thinkzap.line.daily_limit_reached',
      {
        app: 'thinkzap',
        source: 'bitrix',
        dispatchGroupId: settled.dispatchGroupId,
        refusedCount: refusedByLimit.length,
      },
      { msg: 'Robô de envio: destinatários recusados pelo limite diário' },
    )
  }

  // Antes do `return` de "sem timeline": a conversa não depende de haver documento do CRM.
  await openConversations(settled, meta, deps)

  if (!meta.crmDocument) return

  const failed: { name: string; reason: SendRobotFileFailure }[] = [
    ...meta.failedFiles,
  ]
  const sentFiles: string[] = []
  for (const name of new Set(
    settled.parts
      .filter(part => part.kind === 'MEDIA' && part.fileName)
      .map(part => part.fileName as string),
  )) {
    if (acceptedFiles.has(name)) sentFiles.push(name)
    else if (providerFailedFiles.has(name)) {
      failed.push({ name, reason: 'send_failed' })
    }
  }

  const locale = await deps
    .locale(settled.first)
    .catch(() => DEFAULT_NOTICE_LOCALE)

  await deps.postTimeline(
    meta.crmDocument,
    timelineNotices(locale).sendRobot.result({
      fromPhone: meta.fromPhone,
      sent,
      message: meta.message,
      ...(meta.requestedFiles > 0 && {
        files: { sent: sentFiles, failed },
      }),
    }) +
      (refusedByLimit.length > 0
        ? '\n' + dailyLimitNotices(locale).robotRefused(refusedByLimit)
        : ''),
  )
}
