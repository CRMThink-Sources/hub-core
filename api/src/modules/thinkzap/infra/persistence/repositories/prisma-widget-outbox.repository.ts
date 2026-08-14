import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma'
import type { ThinkzapOutboxStatus } from '@/prisma/client'

export type WidgetOutboxStatus =
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
  | 'UNKNOWN'

export type WidgetOutboxRecord = {
  id: string
  clientMessageId: string
  instanceId: string
  subscriptionItemId: string
  domainId: string
  appCode: string
  destination: string
  text: string
  entity: string
  entityId: string
  status: WidgetOutboxStatus
  providerMessageId: string | null
  timelineNotifiedAt: Date | null
  attempts: number
  lastError: string | null
  createdAt: Date
  sentAt: Date | null
}

export type CreateWidgetOutboxInput = {
  clientMessageId: string
  instanceId: string
  subscriptionItemId: string
  domainId: string
  appCode: string
  destination: string
  text: string
  entity: string
  entityId: string
}

function mapRow(row: {
  id: string
  clientMessageId: string
  instanceId: string
  subscriptionItemId: string
  domainId: string
  appCode: string
  destination: string
  text: string
  entity: string
  entityId: string
  status: ThinkzapOutboxStatus
  providerMessageId: string | null
  timelineNotifiedAt: Date | null
  attempts: number
  lastError: string | null
  createdAt: Date
  sentAt: Date | null
}): WidgetOutboxRecord {
  return {
    id: row.id,
    clientMessageId: row.clientMessageId,
    instanceId: row.instanceId,
    subscriptionItemId: row.subscriptionItemId,
    domainId: row.domainId,
    appCode: row.appCode,
    destination: row.destination,
    text: row.text,
    entity: row.entity,
    entityId: row.entityId,
    status: row.status as WidgetOutboxStatus,
    providerMessageId: row.providerMessageId,
    timelineNotifiedAt: row.timelineNotifiedAt,
    attempts: row.attempts,
    lastError: row.lastError,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
  }
}

/**
 * A fila durável do envio pelo widget.
 *
 * O método que carrega o desenho inteiro é `claimForSending`: ele é um **update
 * condicional**, não um read-then-write. Dois workers processando o mesmo job — o que
 * o BullMQ evita, mas nada garante sob falha de rede e job stalled — só podem ter um
 * vencedor, e é o banco que decide. Ler o status e depois gravá-lo deixaria a janela
 * entre as duas operações aberta, que é exatamente onde a mensagem sairia duas vezes.
 */
export class PrismaWidgetOutboxRepository {
  async create(input: CreateWidgetOutboxInput): Promise<WidgetOutboxRecord> {
    const row = await prisma.thinkzapWidgetOutbox.create({
      data: { id: randomUUID(), ...input },
    })

    return mapRow(row)
  }

  async findById(id: string): Promise<WidgetOutboxRecord | null> {
    const row = await prisma.thinkzapWidgetOutbox.findUnique({ where: { id } })
    return row ? mapRow(row) : null
  }

  /**
   * Reivindica a intenção para envio. Devolve `true` só para quem venceu.
   *
   * `updateMany` com `where: { status: 'PENDING' }` é o ponto inteiro: o MySQL aplica
   * a condição na hora do update, então a corrida resolve no banco. `count === 0`
   * significa que outro worker chegou primeiro — ou que a row já saiu de `PENDING` por
   * outro motivo — e o chamador **não** pode enviar.
   */
  async claimForSending(id: string): Promise<boolean> {
    const { count } = await prisma.thinkzapWidgetOutbox.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'SENDING', attempts: { increment: 1 } },
    })

    return count > 0
  }

  /** A marca de entrega. Depois disto, nenhuma retentativa chama o provider. */
  async markSent(id: string, providerMessageId: string): Promise<void> {
    await prisma.thinkzapWidgetOutbox.update({
      where: { id },
      data: { status: 'SENT', providerMessageId, sentAt: new Date() },
    })
  }

  async markFailed(id: string, error: string): Promise<void> {
    await prisma.thinkzapWidgetOutbox.update({
      where: { id },
      data: { status: 'FAILED', lastError: error.slice(0, 2000) },
    })
  }

  /**
   * Morte durante a chamada HTTP ao provider. Estado terminal **por decisão**: não há
   * como saber localmente se a mensagem saiu, e reenviar trocaria uma incerteza rara
   * por duplicidade garantida no WhatsApp de quem recebe.
   */
  async markUnknown(id: string, error: string): Promise<void> {
    await prisma.thinkzapWidgetOutbox.update({
      where: { id },
      data: { status: 'UNKNOWN', lastError: error.slice(0, 2000) },
    })
  }

  /**
   * Devolve a intenção para `PENDING` sem consumir a marca de entrega.
   *
   * Para a falha **antes** da chamada ao provider: a retentativa do BullMQ precisa
   * reencontrar a row reivindicável, senão o claim falharia para sempre e o job
   * morreria em `SENDING` sem nunca ter enviado nada.
   */
  async releaseToPending(id: string, error: string): Promise<void> {
    await prisma.thinkzapWidgetOutbox.updateMany({
      where: { id, status: 'SENDING', providerMessageId: null },
      data: { status: 'PENDING', lastError: error.slice(0, 2000) },
    })
  }

  /** Carimbo de idempotência do comentário de timeline. */
  async markTimelineNotified(id: string): Promise<void> {
    await prisma.thinkzapWidgetOutbox.update({
      where: { id },
      data: { timelineNotifiedAt: new Date() },
    })
  }

  /**
   * Limpeza por retenção. Só `SENT`: `FAILED` e `UNKNOWN` ficam até alguém resolver,
   * porque são exatamente as rows que descrevem mensagem que o cliente não recebeu.
   */
  async deleteSentOlderThan(cutoff: Date): Promise<number> {
    const { count } = await prisma.thinkzapWidgetOutbox.deleteMany({
      where: { status: 'SENT', createdAt: { lt: cutoff } },
    })

    return count
  }

  /** Alimenta o alerta de pendência antiga (ver task de observabilidade). */
  async countPendingOlderThan(cutoff: Date): Promise<number> {
    return prisma.thinkzapWidgetOutbox.count({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
    })
  }
}
