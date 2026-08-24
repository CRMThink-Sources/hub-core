import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma'
import type { ThinkzapOutboxKind, ThinkzapOutboxStatus } from '@/prisma/client'

export type WidgetOutboxStatus =
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
  | 'UNKNOWN'

/**
 * O que o worker vai chamar no provider.
 *
 * Mensagem livre e template compartilham a intenção durável inteira — a marca de
 * entrega, o claim condicional, o lock por destino, os efeitos colaterais. O que muda
 * é uma chamada, e é só isso que este discriminador carrega.
 */
export type WidgetOutboxKind = 'TEXT' | 'TEMPLATE'

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
  kind: WidgetOutboxKind
  /** Preenchidos só em `kind: 'TEMPLATE'`. */
  templateName: string | null
  templateLanguage: string | null
  templateParameters: string[] | null
  status: WidgetOutboxStatus
  providerMessageId: string | null
  timelineNotifiedAt: Date | null
  attempts: number
  lastError: string | null
  /**
   * Operador do Bitrix24 que originou o envio. `null` nas rows gravadas antes da
   * coluna existir — essas entregam sem prefixo de nome.
   */
  operatorBitrixUserId: string | null
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
  /** O texto que o contato lê. Em template, o corpo **já resolvido**. */
  text: string
  entity: string
  entityId: string
  /** Ausente = `TEXT`, que é o que toda row anterior ao template é. */
  kind?: WidgetOutboxKind
  templateName?: string
  templateLanguage?: string
  templateParameters?: string[]
  /** Do token da requisição — é o que o worker usa para resolver o nome. */
  operatorBitrixUserId?: string | null
}

/**
 * O `template_parameters` volta do MySQL como JSON livre, e o tipo do Prisma para
 * coluna `Json` não promete array de string.
 *
 * Row com JSON de outra forma — escrita à mão, ou de uma versão futura que mude o
 * formato — vira `null` em vez de derrubar a leitura: quem consome trata a ausência
 * como template sem variável, e o guard do despacho recusa o que faltar de fato.
 */
function toBodyParameters(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return value.every(item => typeof item === 'string') ? value : null
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
  kind: ThinkzapOutboxKind
  templateName: string | null
  templateLanguage: string | null
  templateParameters: unknown
  status: ThinkzapOutboxStatus
  providerMessageId: string | null
  timelineNotifiedAt: Date | null
  attempts: number
  lastError: string | null
  operatorBitrixUserId: string | null
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
    kind: row.kind as WidgetOutboxKind,
    templateName: row.templateName,
    templateLanguage: row.templateLanguage,
    templateParameters: toBodyParameters(row.templateParameters),
    status: row.status as WidgetOutboxStatus,
    providerMessageId: row.providerMessageId,
    timelineNotifiedAt: row.timelineNotifiedAt,
    attempts: row.attempts,
    lastError: row.lastError,
    operatorBitrixUserId: row.operatorBitrixUserId,
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
    const { templateParameters, ...rest } = input

    /**
     * `templateParameters` fica **fora** do spread quando é `undefined`: numa coluna
     * `Json` do Prisma, `undefined` significa "não escreva" e `null` exigiria
     * `Prisma.DbNull`. Omitir a chave é o único jeito de a row de envio livre nascer
     * com a coluna nula sem importar o sentinela aqui.
     */
    const row = await prisma.thinkzapWidgetOutbox.create({
      data: {
        id: randomUUID(),
        ...rest,
        ...(templateParameters ? { templateParameters } : {}),
      },
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
