import { dailyLimitNotices } from '@/modules/thinkzap/domain/daily-limit-notices'
import {
  DEFAULT_NOTICE_LOCALE,
  NoticeLocale,
} from '@/modules/thinkzap/domain/notices/notice-locale'
import { timelineNotices } from '@/modules/thinkzap/domain/notices/timeline-notices'
import type { OpenChannelConversationQueue } from '@/modules/thinkzap/domain/ports/open-channel-queue.port'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { apiLogger } from '@/shared/infra/logger'
import {
  DAILY_LIMIT_FAILURE,
  SettledDispatchGroup,
} from './dispatch-widget-outbox-message'
import type { WidgetAttachmentGroupMeta } from './enqueue-widget-attachments'
import { resolveOpenChannelText } from './helpers/describe-attachment-text'
import type { WidgetSendOutcome } from './notify-widget-send-outcome'

export type SettleWidgetAttachmentGroupDeps = {
  openChannelQueue: OpenChannelConversationQueue
  /** Publica o comentário na timeline da entidade da row. Nunca lança. */
  postTimeline: (row: WidgetOutboxRecord, message: string) => Promise<void>
  /** O aviso de envio não entregue, como numa mensagem sem grupo. Nunca lança. */
  notifyOutcome: (
    outcome: WidgetSendOutcome,
    row: WidgetOutboxRecord,
  ) => Promise<void>
  /** Telefone da linha, para o "De:" do comentário. Vazio quando não se sabe. */
  fromPhone: (row: WidgetOutboxRecord) => Promise<string>
  locale: (row: WidgetOutboxRecord) => Promise<NoticeLocale>
}

function isWidgetAttachmentMeta(
  value: unknown,
): value is WidgetAttachmentGroupMeta {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'widget-attachment'
  )
}

/**
 * O fim de um envio com anexo pelo widget, quando todas as partes terminaram — o
 * que o caminho síncrono fazia no fim do request:
 *
 * - nada saiu: o aviso de não entregue (ou de limite diário, se foi ele);
 * - algo saiu: a conversa do canal aberto, **uma vez**, ancorada na primeira parte
 *   entregue, e um comentário só na timeline, com os anexos que o limite diário
 *   barrou.
 */
export async function settleWidgetAttachmentGroup(
  settled: SettledDispatchGroup,
  deps: SettleWidgetAttachmentGroupDeps,
): Promise<void> {
  const { first, parts } = settled
  const meta = isWidgetAttachmentMeta(first.dispatchMeta)
    ? first.dispatchMeta
    : { kind: 'widget-attachment', message: null, attachmentKinds: [] }

  const sent = parts.filter(part => part.status === 'SENT')
  const byDailyLimit = parts.filter(
    part => part.status === 'FAILED' && part.lastError === DAILY_LIMIT_FAILURE,
  )

  if (sent.length === 0) {
    const allByLimit = byDailyLimit.length === parts.length
    await deps.notifyOutcome(allByLimit ? 'daily-limit' : 'failed', first)
    return
  }

  const locale = await deps.locale(first).catch(() => DEFAULT_NOTICE_LOCALE)

  const anchor = sent[0]?.providerMessageId
  const text = resolveOpenChannelText(
    meta.message ?? undefined,
    meta.attachmentKinds,
    locale,
  )
  if (anchor && text) {
    try {
      await deps.openChannelQueue.enqueue({
        subscriptionItemId: first.subscriptionItemId,
        domainId: first.domainId,
        appCode: first.appCode,
        instanceId: first.instanceId,
        providerMessageId: anchor,
        destination: first.destination,
        text,
        entity: first.entity,
        entityId: first.entityId,
      })
    } catch (err) {
      apiLogger.error(
        { app: 'thinkzap', dispatchGroupId: settled.dispatchGroupId, err },
        'Não foi possível enfileirar a abertura da conversa; envio preservado',
      )
    }
  }

  const skippedAttachments = byDailyLimit.filter(
    part => part.kind === 'MEDIA',
  ).length

  await deps.postTimeline(
    first,
    timelineNotices(locale).widgetSentSync({
      fromPhone: await deps.fromPhone(first).catch(() => ''),
      destination: first.destination,
      text: meta.message ?? '',
    }) +
      (skippedAttachments > 0
        ? '\n' +
          dailyLimitNotices(locale).attachmentsSkipped(skippedAttachments)
        : ''),
  )
}
