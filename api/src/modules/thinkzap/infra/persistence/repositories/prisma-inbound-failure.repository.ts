import { prisma } from '@/config/prisma'
import type { Prisma, ThinkzapInboundFailureStatus } from '@/prisma/client'

export type CreateInboundFailureInput = {
  jobId: string
  source: string
  type: string
  traceKey?: string | null
  domainId?: string | null
  domainName?: string | null
  instanceId?: string | null
  errorCode: string
  errorMessage: string
  attempts: number
  /** O `body` do evento, necessário para reprocessar. É dado pessoal. */
  payload: unknown
  /** Falha do evento reprocessado aponta para a falha que o originou. */
  previousFailureId?: string | null
}

export type InboundFailureStatus = 'FAILED' | 'REPROCESSED'

export type InboundFailureFilters = {
  statuses: InboundFailureStatus[]
  /** Parte do nome do portal, para a tela geral. */
  domain?: string
  /** O portal exato, para a página do cliente. */
  domainId?: string
  source?: string
  from: Date
  to: Date
  page: number
  limit: number
}

export type InboundFailureRecord = {
  id: string
  jobId: string
  source: string
  type: string
  traceKey: string | null
  domainId: string | null
  domainName: string | null
  instanceId: string | null
  errorCode: string
  errorMessage: string
  attempts: number
  payload: unknown
  status: InboundFailureStatus
  reprocessCount: number
  lastReprocessedAt: Date | null
  lastReprocessedBy: string | null
  previousFailureId: string | null
  createdAt: Date
}

type DbRow = NonNullable<
  Awaited<ReturnType<typeof prisma.thinkzapInboundFailure.findUnique>>
>

function toRecord(row: DbRow): InboundFailureRecord {
  return {
    id: row.id,
    jobId: row.jobId,
    source: row.source,
    type: row.type,
    traceKey: row.traceKey,
    domainId: row.domainId,
    domainName: row.domainName,
    instanceId: row.instanceId,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    attempts: row.attempts,
    payload: row.payload,
    status: row.status,
    reprocessCount: row.reprocessCount,
    lastReprocessedAt: row.lastReprocessedAt,
    lastReprocessedBy: row.lastReprocessedBy,
    previousFailureId: row.previousFailureId,
    createdAt: row.createdAt,
  }
}

/**
 * Falhas **finais** de recebimento (`ThinkzapInboundFailure`). Falha com tentativa pela
 * frente não vira row: o log de cada tentativa é do `PrismaDeliveryAttemptRepository`.
 */
export class PrismaInboundFailureRepository {
  /** Devolve o id da row criada. */
  async create(input: CreateInboundFailureInput): Promise<string> {
    const row = await prisma.thinkzapInboundFailure.create({
      data: {
        jobId: input.jobId,
        source: input.source,
        type: input.type,
        traceKey: input.traceKey ?? null,
        domainId: input.domainId ?? null,
        domainName: input.domainName ?? null,
        instanceId: input.instanceId ?? null,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        attempts: input.attempts,
        payload: input.payload as Prisma.InputJsonValue,
        previousFailureId: input.previousFailureId ?? null,
      },
      select: { id: true },
    })

    return row.id
  }
  /** Da mais recente para a mais antiga. O `count` fica restrito pelo período. */
  async list(
    filters: InboundFailureFilters,
  ): Promise<{ items: InboundFailureRecord[]; total: number }> {
    const where: Prisma.ThinkzapInboundFailureWhereInput = {
      status: { in: filters.statuses },
      createdAt: { gte: filters.from, lte: filters.to },
      ...(filters.domainId ? { domainId: filters.domainId } : {}),
      // O nome fica gravado na própria falha: não precisa de lookup em `Domain`.
      ...(filters.domain ? { domainName: { contains: filters.domain } } : {}),
      ...(filters.source ? { source: filters.source } : {}),
    }

    const [rows, total] = await Promise.all([
      prisma.thinkzapInboundFailure.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.thinkzapInboundFailure.count({ where }),
    ])

    return { items: rows.map(toRecord), total }
  }

  async findById(id: string): Promise<InboundFailureRecord | null> {
    const row = await prisma.thinkzapInboundFailure.findUnique({
      where: { id },
    })
    return row ? toRecord(row) : null
  }

  /**
   * Quem reivindica é quem enfileira: o `updateMany` condicional deixa só um de dois
   * pedidos simultâneos passar de `FAILED` para `REPROCESSED`. `false` = outro pedido
   * chegou antes (ou a falha já foi reprocessada).
   */
  async claimForReprocess(id: string, portalUserId: string): Promise<boolean> {
    const { count } = await prisma.thinkzapInboundFailure.updateMany({
      where: { id, status: 'FAILED' },
      data: {
        status: 'REPROCESSED',
        reprocessCount: { increment: 1 },
        lastReprocessedAt: new Date(),
        lastReprocessedBy: portalUserId,
      },
    })
    return count === 1
  }

  /**
   * Compensa `claimForReprocess` quando o evento não pôde ser enfileirado: sem isto a
   * falha ficaria `REPROCESSED` sem job nenhum, e ninguém mais a reprocessaria.
   */
  async revertReprocess(id: string): Promise<void> {
    await prisma.thinkzapInboundFailure.updateMany({
      where: { id, status: 'REPROCESSED' },
      data: { status: 'FAILED', reprocessCount: { decrement: 1 } },
    })
  }

  /** Expurgo por retenção, em lote (ver `PrismaDeliveryAttemptRepository`). */
  async deleteExpiredBatch(cutoff: Date, limit: number): Promise<number> {
    const rows = await prisma.thinkzapInboundFailure.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
    if (rows.length === 0) return 0

    const { count } = await prisma.thinkzapInboundFailure.deleteMany({
      where: { id: { in: rows.map(row => row.id) } },
    })
    return count
  }

  /** E-mail de quem reprocessou por último, para o detalhe. */
  async portalUserEmail(userId: string): Promise<string | null> {
    const user = await prisma.portalUser.findUnique({
      where: { id: userId },
      select: { email: true },
    })
    return user?.email ?? null
  }
}
