import type {
  InboundFailureFilters,
  InboundFailureRecord,
  PrismaInboundFailureRepository,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-inbound-failure.repository'
import type {
  DeliveryAttemptRecord,
  PrismaDeliveryAttemptRepository,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-delivery-attempt.repository'
import {
  describeInboundPayload,
  isReprocessableInboundSource,
  reprocessJobId,
} from '@/modules/thinkzap/domain/inbound-failure-routing'
import type { ThinkzapInboundJob } from '@/queue/thinkzap-inbound.queue'
import { apiLogger } from '@/shared/infra/logger'

/** Tamanho do trecho do erro na lista; o detalhe traz o erro inteiro. */
export const INBOUND_ERROR_PREVIEW_LENGTH = 200

/** Mesmo teto do lote de envio: o resultado de cada id é independente. */
export const MAX_INBOUND_REPROCESS_BATCH = 50

type FailureRepository = Pick<
  PrismaInboundFailureRepository,
  | 'list'
  | 'findById'
  | 'claimForReprocess'
  | 'revertReprocess'
  | 'portalUserEmail'
>

/** O que a tela mostra de uma falha de recebimento. Sem o conteúdo do evento. */
export type InboundFailureView = {
  id: string
  createdAt: Date
  source: string
  type: string
  traceKey: string | null
  domainId: string | null
  domainName: string | null
  errorCode: string
  errorMessage: string
  attempts: number
  status: InboundFailureRecord['status']
  reprocessCount: number
  lastReprocessedAt: Date | null
  /** Só `FAILED`, de origem cuja reentrega não repete efeito externo. */
  reprocessable: boolean
}

export type InboundFailureDetailView = InboundFailureView & {
  instanceId: string | null
  /** Campos seguros do evento (ids), nunca o conteúdo da mensagem. */
  payloadFields: Record<string, string>
  previousFailureId: string | null
  lastReprocessedByEmail: string | null
  /** Tentativas que falharam, em ordem. Vazio quando já expurgadas. */
  attemptLog: DeliveryAttemptRecord[]
}

function reprocessableOf(failure: InboundFailureRecord): boolean {
  return (
    failure.status === 'FAILED' && isReprocessableInboundSource(failure.source)
  )
}

function toView(
  failure: InboundFailureRecord,
  errorMessage: string,
): InboundFailureView {
  return {
    id: failure.id,
    createdAt: failure.createdAt,
    source: failure.source,
    type: failure.type,
    traceKey: failure.traceKey,
    domainId: failure.domainId,
    domainName: failure.domainName,
    errorCode: failure.errorCode,
    errorMessage,
    attempts: failure.attempts,
    status: failure.status,
    reprocessCount: failure.reprocessCount,
    lastReprocessedAt: failure.lastReprocessedAt,
    reprocessable: reprocessableOf(failure),
  }
}

function preview(text: string): string {
  return text.length > INBOUND_ERROR_PREVIEW_LENGTH
    ? `${text.slice(0, INBOUND_ERROR_PREVIEW_LENGTH)}…`
    : text
}

export class ListInboundFailures {
  constructor(private readonly failures: Pick<FailureRepository, 'list'>) {}

  async execute(filters: InboundFailureFilters) {
    const { items, total } = await this.failures.list(filters)

    return {
      items: items.map(item => toView(item, preview(item.errorMessage))),
      total,
      page: filters.page,
      limit: filters.limit,
    }
  }
}

export class GetInboundFailure {
  constructor(
    private readonly failures: Pick<
      FailureRepository,
      'findById' | 'portalUserEmail'
    >,
    private readonly attempts?: Pick<
      PrismaDeliveryAttemptRepository,
      'listByRef'
    >,
  ) {}

  /** `null` quando não existe, ou quando o prazo de guarda já a apagou. */
  async execute(id: string): Promise<InboundFailureDetailView | null> {
    const failure = await this.failures.findById(id)
    if (!failure) return null

    const [attemptLog, lastReprocessedByEmail] = await Promise.all([
      this.attemptsOf(failure.jobId),
      failure.lastReprocessedBy
        ? this.failures.portalUserEmail(failure.lastReprocessedBy)
        : Promise.resolve(null),
    ])

    return {
      ...toView(failure, failure.errorMessage),
      instanceId: failure.instanceId,
      payloadFields: describeInboundPayload(failure.source, failure.payload),
      previousFailureId: failure.previousFailureId,
      lastReprocessedByEmail,
      attemptLog,
    }
  }

  /** O log é complemento: se a leitura falhar, o detalhe sai sem ele. */
  private async attemptsOf(jobId: string): Promise<DeliveryAttemptRecord[]> {
    if (!this.attempts) return []
    try {
      return await this.attempts.listByRef({ kind: 'INBOUND', id: jobId })
    } catch (err) {
      apiLogger.warn(
        { app: 'thinkzap', jobId, err },
        'Falha ao ler as tentativas da falha de recebimento; detalhe sai sem elas',
      )
      return []
    }
  }
}

/**
 * - `requeued`: o evento voltou para a fila de entrada.
 * - `conflict`: já foi reprocessada (ou outro pedido chegou antes) — nada mudou.
 * - `not-reprocessable`: origem cuja reentrega poderia repetir um efeito externo.
 * - `not-found`: id inexistente ou já expurgado.
 * - `schedule-failed`: o evento não pôde ser enfileirado; a falha volta a `FAILED`.
 */
export type InboundReprocessStatus =
  | 'requeued'
  | 'conflict'
  | 'not-reprocessable'
  | 'not-found'
  | 'schedule-failed'

export type InboundReprocessResult = {
  id: string
  status: InboundReprocessStatus
}

/** Recoloca o evento na fila de entrada. */
export type InboundReenqueuer = {
  enqueue(job: ThinkzapInboundJob, jobId: string): Promise<void>
}

export class ReprocessInboundFailures {
  constructor(
    private readonly failures: Pick<
      FailureRepository,
      'findById' | 'claimForReprocess' | 'revertReprocess'
    >,
    private readonly queue: InboundReenqueuer,
  ) {}

  /** Em série: o lote é pequeno e a recusa de um id não impede os demais. */
  async execute(input: {
    ids: string[]
    portalUserId: string
  }): Promise<InboundReprocessResult[]> {
    const results: InboundReprocessResult[] = []
    for (const id of new Set(input.ids)) {
      results.push({
        id,
        status: await this.reprocessOne(id, input.portalUserId),
      })
    }
    return results
  }

  private async reprocessOne(
    id: string,
    portalUserId: string,
  ): Promise<InboundReprocessStatus> {
    const failure = await this.failures.findById(id)
    if (!failure) return 'not-found'

    if (!isReprocessableInboundSource(failure.source)) {
      return 'not-reprocessable'
    }

    // Quem reivindica é quem enfileira: dois pedidos simultâneos não enfileiram duas vezes.
    if (!(await this.failures.claimForReprocess(id, portalUserId))) {
      return 'conflict'
    }

    const jobId = reprocessJobId(id, failure.reprocessCount + 1)
    try {
      await this.queue.enqueue(
        {
          source: failure.source,
          type: failure.type,
          traceKey: failure.traceKey ?? '',
          body: failure.payload as Record<string, unknown>,
        } as ThinkzapInboundJob,
        jobId,
      )
    } catch (err) {
      apiLogger.error(
        { app: 'thinkzap', inboundFailureId: id, err },
        'Reprocessamento de recebimento: falha ao enfileirar — falha devolvida a FAILED',
      )
      await this.failures.revertReprocess(id)
      return 'schedule-failed'
    }

    apiLogger.info(
      {
        app: 'thinkzap',
        inboundFailureId: id,
        jobId,
        source: failure.source,
        portalUserId,
        traceKey: failure.traceKey,
      },
      'Evento recebido reprocessado pelo portal admin',
    )

    return 'requeued'
  }
}
