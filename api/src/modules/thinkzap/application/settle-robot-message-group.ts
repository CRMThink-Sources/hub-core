import { dailyLimitNotices } from '@/modules/thinkzap/domain/daily-limit-notices'
import {
  DEFAULT_NOTICE_LOCALE,
  NoticeLocale,
} from '@/modules/thinkzap/domain/notices/notice-locale'
import {
  SendRobotFileFailure,
  timelineNotices,
} from '@/modules/thinkzap/domain/notices/timeline-notices'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { apiLogger } from '@/shared/infra/logger'
import {
  DAILY_LIMIT_FAILURE,
  SettledDispatchGroup,
} from './dispatch-widget-outbox-message'
import type { RobotMessageGroupMeta } from './enqueue-robot-message'

export type SettleRobotMessageGroupDeps = {
  /** Comentário na timeline do documento. Nunca lança. */
  postTimeline: (
    document: { entity: string; entityId: string },
    message: string,
  ) => Promise<void>
  locale: (row: WidgetOutboxRecord) => Promise<NoticeLocale>
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
