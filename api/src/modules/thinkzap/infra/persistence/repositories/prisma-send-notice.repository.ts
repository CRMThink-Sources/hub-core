import { prisma } from '@/config/prisma'

export type SendNoticeRecord = {
  id: string
  /** Identidade do disparo; única. */
  dispatchKey: string
  domainId: string
  appCode: string
  entity: string
  entityId: string
  operatorBitrixUserId: string | null
  /** Publica o comentário sem esperar a fila terminar todas as partes. */
  eager: boolean
  commentId: string | null
  commentAsAuthor: boolean
  commentClaimedAt: Date | null
  fromPhone: string | null
  alertedFailures: number
  createdAt: Date
  updatedAt: Date
}

export type EnsureSendNoticeInput = {
  dispatchKey: string
  domainId: string
  appCode: string
  entity: string
  entityId: string
  operatorBitrixUserId: string | null
  /** Ausente = `false`, o default do banco. */
  eager?: boolean
}

/** P2002 é "unique constraint failed". */
function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'P2002'
}

/** O aviso de um disparo acompanhado (`ThinkzapSendNotice`). */
export class PrismaSendNoticeRepository {
  /**
   * O aviso do disparo, criado na primeira chamada e **nunca sobrescrito**: as
   * seguintes não podem zerar o comentário já publicado.
   *
   * O upsert do Prisma no MariaDB não é atômico: partes de um grupo que terminam
   * juntas podem tentar o insert as duas, e a perdedora bate no unique de
   * `dispatchKey`. Aí o aviso já existe, e basta relê-lo.
   */
  async ensure(input: EnsureSendNoticeInput): Promise<SendNoticeRecord> {
    const where = { dispatchKey: input.dispatchKey }

    try {
      return await prisma.thinkzapSendNotice.upsert({
        where,
        create: input,
        update: {},
      })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error

      const existing = await prisma.thinkzapSendNotice.findUnique({ where })
      if (!existing) throw error
      return existing
    }
  }

  async findById(id: string): Promise<SendNoticeRecord | null> {
    return prisma.thinkzapSendNotice.findUnique({ where: { id } })
  }

  /**
   * Reivindica a criação do comentário. Update condicional, para o banco decidir a
   * corrida: devolve `true` só a quem venceu, e só esse publica.
   */
  async claimComment(id: string, at: Date): Promise<boolean> {
    const { count } = await prisma.thinkzapSendNotice.updateMany({
      where: { id, commentClaimedAt: null },
      data: { commentClaimedAt: at },
    })

    return count > 0
  }

  async saveComment(
    id: string,
    input: { commentId: string; asAuthor: boolean },
  ): Promise<void> {
    await prisma.thinkzapSendNotice.update({
      where: { id },
      data: { commentId: input.commentId, commentAsAuthor: input.asAuthor },
    })
  }

  async saveFromPhone(id: string, phone: string): Promise<void> {
    await prisma.thinkzapSendNotice.update({
      where: { id },
      data: { fromPhone: phone },
    })
  }

  async saveAlerted(id: string, failures: number): Promise<void> {
    await prisma.thinkzapSendNotice.update({
      where: { id },
      data: { alertedFailures: failures },
    })
  }

  /**
   * Expurgo por retenção: apaga até `limit` avisos criados antes de `cutoff` e
   * devolve quantos. O `deleteMany` do Prisma não aceita `LIMIT`, então os ids vêm
   * antes — em lote, para nenhuma operação segurar a tabela por muito tempo.
   */
  async deleteExpiredBatch(cutoff: Date, limit: number): Promise<number> {
    const rows = await prisma.thinkzapSendNotice.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
    if (rows.length === 0) return 0

    const { count } = await prisma.thinkzapSendNotice.deleteMany({
      where: { id: { in: rows.map(row => row.id) } },
    })
    return count
  }
}
