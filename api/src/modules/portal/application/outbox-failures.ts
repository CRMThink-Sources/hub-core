import type {
  OutboxFailure,
  OutboxFailureDetail,
  OutboxFailureFilters,
  PrismaWidgetOutboxRepository,
  WidgetOutboxRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import type { WidgetSendScheduler } from '@/modules/thinkzap/domain/ports/widget-send-queue.port'
import { apiLogger } from '@/shared/infra/logger'

/** Tamanho do trecho do texto na lista; o detalhe traz o texto inteiro. */
export const FAILURE_TEXT_PREVIEW_LENGTH = 200

/** Máximo de intenções por pedido de reprocessamento em lote. */
export const MAX_REPROCESS_BATCH = 50

type FailureRepository = Pick<
  PrismaWidgetOutboxRepository,
  | 'listFailures'
  | 'findFailureDetail'
  | 'findById'
  | 'requeueForReprocess'
  | 'markFailed'
>

/** O que a tela mostra de uma intenção. Sem credenciais nem payloads internos. */
export type OutboxFailureView = {
  id: string
  createdAt: Date
  updatedAt: Date
  domainId: string
  domainName: string | null
  appCode: string
  subscriptionItemId: string
  origin: WidgetOutboxRecord['origin']
  kind: WidgetOutboxRecord['kind']
  status: WidgetOutboxRecord['status']
  text: string
  fileName: string | null
  destination: string
  lastError: string | null
  attempts: number
  reprocessCount: number
  lastReprocessedAt: Date | null
}

export type OutboxFailureDetailView = OutboxFailureView & {
  templateName: string | null
  mediaType: WidgetOutboxRecord['mediaType']
  caption: string | null
  bitrixChatId: string | null
  bitrixMessageId: string | null
  operatorBitrixUserId: string | null
  entity: string
  entityId: string
  providerMessageId: string | null
  sentAt: Date | null
  lastReprocessedByEmail: string | null
}

function toView(failure: OutboxFailure, text: string): OutboxFailureView {
  return {
    id: failure.id,
    createdAt: failure.createdAt,
    updatedAt: failure.updatedAt,
    domainId: failure.domainId,
    domainName: failure.domainName,
    appCode: failure.appCode,
    subscriptionItemId: failure.subscriptionItemId,
    origin: failure.origin,
    kind: failure.kind,
    status: failure.status,
    text,
    fileName: failure.fileName,
    destination: failure.destination,
    lastError: failure.lastError,
    attempts: failure.attempts,
    reprocessCount: failure.reprocessCount,
    lastReprocessedAt: failure.lastReprocessedAt,
  }
}

function preview(text: string): string {
  return text.length > FAILURE_TEXT_PREVIEW_LENGTH
    ? `${text.slice(0, FAILURE_TEXT_PREVIEW_LENGTH)}…`
    : text
}

export class ListOutboxFailures {
  constructor(
    private readonly outbox: Pick<FailureRepository, 'listFailures'>,
  ) {}

  async execute(filters: OutboxFailureFilters) {
    const { items, total } = await this.outbox.listFailures(filters)

    return {
      items: items.map(item => toView(item, preview(item.text))),
      total,
      page: filters.page,
      limit: filters.limit,
    }
  }
}

export class GetOutboxFailure {
  constructor(
    private readonly outbox: Pick<FailureRepository, 'findFailureDetail'>,
  ) {}

  /**
   * `null` também para a intenção que nunca falhou: a tela é de falhas, e uma row
   * entregue de primeira não tem o que fazer aqui. A reprocessada continua visível,
   * para acompanhar o desfecho do reprocessamento.
   */
  async execute(id: string): Promise<OutboxFailureDetailView | null> {
    const detail = await this.outbox.findFailureDetail(id)
    if (!detail) return null

    const failedOnce =
      detail.status === 'FAILED' ||
      detail.status === 'UNKNOWN' ||
      detail.reprocessCount > 0
    if (!failedOnce) return null

    return toDetailView(detail)
  }
}

function toDetailView(detail: OutboxFailureDetail): OutboxFailureDetailView {
  return {
    ...toView(detail, detail.text),
    templateName: detail.templateName,
    mediaType: detail.mediaType,
    caption: detail.caption,
    bitrixChatId: detail.bitrixChatId,
    bitrixMessageId: detail.bitrixMessageId,
    operatorBitrixUserId: detail.operatorBitrixUserId,
    entity: detail.entity,
    entityId: detail.entityId,
    providerMessageId: detail.providerMessageId,
    sentAt: detail.sentAt,
    lastReprocessedByEmail: detail.lastReprocessedByEmail,
  }
}

/**
 * - `requeued`: voltou para a fila e tem job agendado.
 * - `conflict`: já saiu de `FAILED`/`UNKNOWN` (reenviada, em envio, ou outro pedido
 *   chegou antes) — nada mudou.
 * - `needs-confirmation`: `UNKNOWN` sem o aceite do risco de duplicidade.
 * - `not-found`: id inexistente.
 * - `schedule-failed`: voltou para `PENDING` mas o job não pôde ser criado; a row é
 *   devolvida a `FAILED` para não ficar parada sem ninguém para acordá-la.
 */
export type ReprocessStatus =
  | 'requeued'
  | 'conflict'
  | 'needs-confirmation'
  | 'not-found'
  | 'schedule-failed'

export type ReprocessResult = { id: string; status: ReprocessStatus }

export class ReprocessOutboxFailures {
  constructor(
    private readonly outbox: Pick<
      FailureRepository,
      'findById' | 'requeueForReprocess' | 'markFailed'
    >,
    private readonly scheduler: WidgetSendScheduler,
  ) {}

  /**
   * Um pedido por vez, em série: o lote é pequeno (até 50) e o resultado de cada id
   * é independente — uma recusa não impede as demais.
   */
  async execute(input: {
    ids: string[]
    portalUserId: string
    acknowledgeDuplicateRisk: boolean
  }): Promise<ReprocessResult[]> {
    const results: ReprocessResult[] = []
    for (const id of new Set(input.ids)) {
      results.push({ id, status: await this.reprocessOne(id, input) })
    }
    return results
  }

  private async reprocessOne(
    id: string,
    input: { portalUserId: string; acknowledgeDuplicateRisk: boolean },
  ): Promise<ReprocessStatus> {
    const row = await this.outbox.findById(id)
    if (!row) return 'not-found'

    if (row.status === 'UNKNOWN' && !input.acknowledgeDuplicateRisk) {
      return 'needs-confirmation'
    }

    const requeued = await this.outbox.requeueForReprocess(id, {
      portalUserId: input.portalUserId,
      allowUnknown: input.acknowledgeDuplicateRisk,
    })
    if (!requeued) return 'conflict'

    try {
      await this.scheduler.ensureScheduled(id)
    } catch (err) {
      apiLogger.error(
        { app: 'thinkzap', outboxId: id, err },
        'Reprocessamento: falha ao agendar o job — intenção devolvida a FAILED',
      )
      await this.outbox.markFailed(
        id,
        'Falha ao agendar o reprocessamento; tente de novo.',
      )
      return 'schedule-failed'
    }

    apiLogger.info(
      {
        app: 'thinkzap',
        outboxId: id,
        portalUserId: input.portalUserId,
        previousStatus: row.status,
        previousError: row.lastError,
      },
      'Intenção de envio reprocessada pelo portal admin',
    )

    return 'requeued'
  }
}
