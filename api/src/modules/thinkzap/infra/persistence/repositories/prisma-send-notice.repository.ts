import { prisma } from '@/config/prisma'

/** Teto de páginas varridas por chamada do expurgo: a rodada tem prazo. */
const MAX_SCAN_PAGES = 20

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
   *
   * **Poupa o aviso que ainda tem row do outbox apontando para ele** (não há chave
   * estrangeira): row pendente numa cadência longa, reprocessada ou com recusa tardia
   * ainda aciona o comentário e o alerta, que sem o aviso não fazem nada, em silêncio.
   * Aviso referenciado na frente da fila não pode travar os de trás: a varredura segue
   * por cursor, até `MAX_SCAN_PAGES` páginas, e para ao juntar `limit` apagados ou ao
   * acabar os vencidos. Devolver menos que `limit` encerra o alvo no job, então a
   * rodada nunca gira sobre as mesmas linhas.
   */
  async deleteExpiredBatch(cutoff: Date, limit: number): Promise<number> {
    let deleted = 0
    let cursor: string | undefined

    for (let page = 0; page < MAX_SCAN_PAGES && deleted < limit; page++) {
      const take = limit - deleted
      const rows = await prisma.thinkzapSendNotice.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      if (rows.length === 0) break

      const ids = rows.map(row => row.id)
      const referenced = await prisma.thinkzapWidgetOutbox.findMany({
        where: { sendNoticeId: { in: ids } },
        select: { sendNoticeId: true },
        distinct: ['sendNoticeId'],
      })
      const kept = new Set(referenced.map(row => row.sendNoticeId))
      const expired = ids.filter(id => !kept.has(id))

      if (expired.length > 0) {
        const { count } = await prisma.thinkzapSendNotice.deleteMany({
          // Reconfirma o corte no delete, como os outros expurgos em lote.
          where: { id: { in: expired }, createdAt: { lt: cutoff } },
        })
        deleted += count
      }

      if (rows.length < take) break
      cursor = ids[ids.length - 1]
    }

    return deleted
  }
}
