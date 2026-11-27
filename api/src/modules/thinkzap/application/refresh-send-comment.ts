import type { NoticeLocale } from '@/modules/thinkzap/domain/notices/notice-locale'
import {
  renderSendComment,
  type SendCommentInput,
} from '@/modules/thinkzap/domain/notices/send-comment'
import {
  timelineNotices,
  type SendRobotFileFailure,
  type SendRobotFilesResult,
} from '@/modules/thinkzap/domain/notices/timeline-notices'
import {
  isSettled,
  summarizeRecipients,
} from '@/modules/thinkzap/domain/send-notice'
import type {
  PrismaSendNoticeRepository,
  SendNoticeRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-send-notice.repository'
import type {
  PrismaWidgetOutboxRepository,
  WidgetOutboxRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import type {
  PublishedComment,
  SendNotificationInput,
  TimelineCommentPublisher,
} from '@/shared/data/contracts/send-notification'
import { apiLogger } from '@/shared/infra/logger'
import {
  DAILY_LIMIT_FAILURE,
  isAutomationOrigin,
  MEDIA_EXPIRED_FAILURE,
} from './dispatch-widget-outbox-message'
import { describeSendFailure, toSendPart } from './helpers/send-failure'

export type RefreshSendCommentDeps = {
  notices: Pick<
    PrismaSendNoticeRepository,
    'findById' | 'claimComment' | 'saveComment' | 'saveFromPhone'
  >
  outbox: Pick<PrismaWidgetOutboxRepository, 'findBySendNotice'>
  /** `null` = sem como falar com o Bitrix do portal (domínio removido). */
  publisher: (
    notice: SendNoticeRecord,
  ) => Promise<TimelineCommentPublisher | null>
  locale: (notice: SendNoticeRecord) => Promise<NoticeLocale>
  /** Telefone da linha, para o "De:". Vazio quando não se sabe. */
  fromPhone: (row: WidgetOutboxRecord) => Promise<string>
  now: () => Date
}

/**
 * Lançado quando outra execução já reivindicou a publicação. O job tenta de novo, e
 * a próxima execução encontra o `commentId` e edita.
 */
export class SendCommentClaimLostError extends Error {
  constructor(noticeId: string) {
    super(
      `O comentário do aviso de envio ${noticeId} está sendo publicado por outra execução; a próxima tentativa edita o comentário publicado.`,
    )
    this.name = 'SendCommentClaimLostError'
  }
}

type RobotMeta = {
  fromPhone?: unknown
  failedFiles?: unknown
}

function stringField(
  meta: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = meta?.[key]
  return typeof value === 'string' ? value : null
}

const FILE_FAILURES: readonly string[] = [
  'unavailable',
  'too_large',
  'send_failed',
]

/** Os arquivos que nem saíram do Bitrix, gravados no `dispatchMeta` do robô. */
function robotFailedFiles(
  meta: RobotMeta | null,
): { name: string; reason: SendRobotFileFailure }[] {
  if (!Array.isArray(meta?.failedFiles)) return []
  return meta.failedFiles.flatMap(item => {
    const file = (item ?? {}) as { name?: unknown; reason?: unknown }
    return typeof file.name === 'string' &&
      typeof file.reason === 'string' &&
      FILE_FAILURES.includes(file.reason)
      ? [{ name: file.name, reason: file.reason as SendRobotFileFailure }]
      : []
  })
}

/**
 * Arquivos enviados e não enviados, como `settle-robot-message-group.ts`: aceito para
 * algum destinatário é enviado; recusado pelo limite diário não entra em lista
 * nenhuma, porque o destinatário já mostra o motivo. Parte na fila ou sem confirmação
 * também fica de fora: dizer "não enviado" ali convidaria a reenviar.
 */
function filesOf(
  rows: WidgetOutboxRecord[],
  first: WidgetOutboxRecord,
): SendRobotFilesResult | undefined {
  const robot = first.origin === 'ROBOT_MESSAGE'
  const meta = robot ? (first.dispatchMeta as RobotMeta | null) : null
  const media = rows.filter(row => row.kind === 'MEDIA' && row.fileName)
  const requested = robot && Number(first.dispatchMeta?.requestedFiles) > 0
  if (media.length === 0 && !requested) return undefined

  const accepted = new Set<string>()
  const failedReason = new Map<string, SendRobotFileFailure>()
  for (const row of media) {
    const name = row.fileName as string
    if (row.status === 'SENT' && row.rejectedAt === null) accepted.add(name)
    else if (row.status === 'FAILED' && row.lastError !== DAILY_LIMIT_FAILURE) {
      failedReason.set(
        name,
        row.lastError === MEDIA_EXPIRED_FAILURE ? 'unavailable' : 'send_failed',
      )
    } else if (row.rejectedAt !== null && !failedReason.has(name)) {
      failedReason.set(name, 'send_failed')
    }
  }

  const failed = robotFailedFiles(meta)
  const sent: string[] = []
  for (const name of new Set(media.map(row => row.fileName as string))) {
    const reason = failedReason.get(name)
    if (accepted.has(name)) sent.push(name)
    else if (reason) failed.push({ name, reason })
  }

  return { sent, failed }
}

function kindOf(row: WidgetOutboxRecord): SendCommentInput['kind'] {
  if (row.kind === 'TEMPLATE') return 'template'
  if (row.kind === 'INTERACTIVE_BUTTON') return 'buttons'
  return 'message'
}

/**
 * O "De:" do comentário. A consulta à linha sai uma vez só: o resultado fica no
 * aviso, e as edições seguintes não voltam ao provider.
 */
async function resolveFromPhone(
  notice: SendNoticeRecord,
  first: WidgetOutboxRecord,
  deps: RefreshSendCommentDeps,
): Promise<string> {
  if (notice.fromPhone) return notice.fromPhone

  const fromMeta = stringField(first.dispatchMeta, 'fromPhone')
  if (fromMeta) return fromMeta

  const phone = await deps.fromPhone(first).catch(() => '')
  if (phone) await deps.notices.saveFromPhone(notice.id, phone)
  return phone
}

function render(
  rows: WidgetOutboxRecord[],
  locale: NoticeLocale,
  fromPhone: string,
): string {
  const first = rows.find(row => row.partIndex === 0) ?? rows[0]!
  const kind = kindOf(first)

  return renderSendComment({
    locale,
    kind,
    automation: isAutomationOrigin(first.origin),
    fromPhone,
    ...(kind === 'template' && {
      template: {
        name: first.templateName ?? '',
        language: first.templateLanguage ?? '',
      },
    }),
    text: stringField(first.dispatchMeta, 'message') ?? first.text,
    recipients: summarizeRecipients(rows.map(toSendPart)),
    files: filesOf(rows, first),
    describeFailure: describeSendFailure(locale),
  })
}

/**
 * Publica ou edita o comentário de status de um disparo acompanhado. O comentário é
 * remontado inteiro a partir das rows, então rodar de novo só repete o mesmo texto.
 *
 * A publicação é **no máximo uma vez**: `crm.timeline.comment.add` não é idempotente,
 * e uma falha ambígua pode ter gravado o comentário. Por isso a reivindicação nunca é
 * devolvida e `publish` nulo não é repetido — um aviso reivindicado que nunca ganhou
 * `commentId` esgota as tentativas do job e fica sem comentário, de propósito. Editar
 * é idempotente: a falha sobe e o job tenta de novo.
 */
export async function refreshSendComment(
  noticeId: string,
  deps: RefreshSendCommentDeps,
): Promise<void> {
  const notice = await deps.notices.findById(noticeId)
  if (!notice || !notice.entity || !notice.entityId) return

  const rows = await deps.outbox.findBySendNotice(noticeId)
  if (rows.length === 0) return

  const { commentId } = notice
  if (!commentId && !notice.eager && !isSettled(rows.map(toSendPart))) return

  const publisher = await deps.publisher(notice)
  if (!publisher) {
    apiLogger.warn(
      { app: 'thinkzap', noticeId },
      'Aviso de envio sem cliente Bitrix: comentário não publicado',
    )
    return
  }

  const locale = await deps.locale(notice)
  const first = rows.find(row => row.partIndex === 0) ?? rows[0]!
  const fromPhone = await resolveFromPhone(notice, first, deps)

  const author: Pick<
    SendNotificationInput,
    'authorBitrixUserId' | 'senderLine'
  > = notice.operatorBitrixUserId
    ? {
        authorBitrixUserId: notice.operatorBitrixUserId,
        senderLine: timelineNotices(locale).sentBy,
      }
    : {}
  const target = { contextId: notice.entityId, entity: notice.entity }

  // Relidas logo antes de escrever: uma execução mais lenta não pode gravar por
  // cima um status mais velho do que o que a fila já tem. E antes da reivindicação,
  // que é única: uma falha aqui não pode gastá-la sem chegar ao Bitrix.
  const latest = await deps.outbox.findBySendNotice(noticeId)
  const message = render(latest.length > 0 ? latest : rows, locale, fromPhone)

  if (commentId) {
    const updated = await publisher.update({
      ...target,
      ...author,
      message,
      commentId,
      asAuthor: notice.commentAsAuthor,
    })
    if (!updated) {
      apiLogger.warn(
        { app: 'thinkzap', noticeId, commentId },
        'Comentário do aviso de envio não existe mais no Bitrix; não será recriado',
      )
    }
    return
  }

  const claimed = await deps.notices.claimComment(noticeId, deps.now())
  if (!claimed) throw new SendCommentClaimLostError(noticeId)

  const published = await publisher.publish({ ...target, ...author, message })
  if (!published) {
    apiLogger.warn(
      { app: 'thinkzap', noticeId },
      'Comentário do aviso de envio não publicado; não será repetido para não duplicar',
    )
    return
  }

  await saveCommentWithRetry(noticeId, published, deps)
}

const SAVE_COMMENT_ATTEMPTS = 3

/**
 * Sem o `commentId` gravado o comentário publicado nunca mais é editado, e a
 * reivindicação impede publicar outro. Gravar é idempotente, então vale insistir
 * aqui mesmo; esgotado, o id vai ao log para não se perder.
 */
async function saveCommentWithRetry(
  noticeId: string,
  published: PublishedComment,
  deps: RefreshSendCommentDeps,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await deps.notices.saveComment(noticeId, published)
      return
    } catch (err) {
      if (attempt >= SAVE_COMMENT_ATTEMPTS) {
        apiLogger.error(
          {
            app: 'thinkzap',
            noticeId,
            commentId: published.commentId,
            asAuthor: published.asAuthor,
            err,
          },
          'Comentário do aviso de envio publicado, mas o id não foi gravado: ele não será mais atualizado',
        )
        throw err
      }
    }
  }
}
