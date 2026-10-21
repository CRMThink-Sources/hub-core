import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import type { SendCadence } from '@/modules/thinkzap/domain/ports/send-cadence.port'
import type {
  WidgetOutboxOrigin,
  WidgetOutboxRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { findConnectorLineWithEntitlement } from './helpers/resolve-line-by-subscription-item'

/** Página padrão da lista (o card mostra 10 por vez) e o máximo aceito. */
export const CADENCE_QUEUE_PAGE_SIZE = 10
export const CADENCE_QUEUE_MAX_PAGE_SIZE = 50

/** Tamanho do trecho do texto na lista. */
const PREVIEW_LENGTH = 80

export type CadenceQueueItem = {
  /** Posição na fila inteira; 1 = a próxima a sair. */
  position: number
  origin: WidgetOutboxOrigin
  /** Nome do operador, na resposta do operador; `null` nas outras origens ou sem leitura. */
  operatorName: string | null
  destination: string
  /** Texto, legenda ou nome do arquivo, já cortado. `null` = mídia sem nome nem legenda. */
  preview: string | null
  /** Tipo da mídia, quando a parte é mídia (o front rotula). */
  mediaType: WidgetOutboxRecord['mediaType']
  /** Epoch ms. */
  enqueuedAt: number
  /** Saída prevista (fim da janela/pausa), quando já esperou alguma; epoch ms. */
  waitUntil: number | null
}

export type CadenceQueueListing = {
  /** Total na fila da linha (não só os listados). */
  total: number
  /** Posição (0 = cabeça) do primeiro ticket da página e o tamanho dela. */
  offset: number
  limit: number
  messages: CadenceQueueItem[]
}

function cut(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > PREVIEW_LENGTH
    ? `${flat.slice(0, PREVIEW_LENGTH - 1)}…`
    : flat
}

function previewOf(row: WidgetOutboxRecord): string | null {
  if (row.kind === 'MEDIA') {
    const text = row.caption?.trim() || row.fileName?.trim()
    return text ? cut(text) : null
  }
  return row.text.trim() ? cut(row.text) : null
}

/**
 * Nome de exibição dos operadores do Bitrix24 da instalação. Devolve só os que
 * conseguiu ler; nunca lança — sem nome, a lista mostra só a origem.
 */
export type ResolveOperatorNames = (
  installation: { domainName: string; appCode: string },
  bitrixUserIds: string[],
) => Promise<Map<string, string>>

/**
 * As mensagens que aguardam na fila da linha, **na ordem em que vão sair** — a ordem
 * é a do sequenciador FIFO no Redis, não a do banco. Só leitura: a lista não oferece
 * ação nenhuma sobre as mensagens.
 *
 * Paginada: lê só o trecho pedido da fila. A posição é a da fila inteira. Ticket
 * sem row (já terminou entre as duas leituras, ou é órfão que a varredura ainda vai
 * recolher) fica de fora, e a página pode vir com menos itens.
 */
export class ListLineCadenceQueue {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly cadence: SendCadence,
    private readonly outbox: {
      findByIds(ids: string[]): Promise<WidgetOutboxRecord[]>
    },
    private readonly resolveOperatorNames: ResolveOperatorNames | null = null,
  ) {}

  async execute(input: {
    subscriptionItemId: string
    domainId: string
    appCode: string
    offset?: number
    limit?: number
  }): Promise<CadenceQueueListing> {
    const offset = Math.max(0, Math.trunc(input.offset ?? 0))
    const limit = Math.min(
      Math.max(1, Math.trunc(input.limit ?? CADENCE_QUEUE_PAGE_SIZE)),
      CADENCE_QUEUE_MAX_PAGE_SIZE,
    )
    const context = await this.getAplicationContext.execute({
      domainId: input.domainId,
      appCode: input.appCode,
    })
    const { item } = findConnectorLineWithEntitlement(
      context,
      input.subscriptionItemId,
      new Date(),
    )
    if (item.metadata.provider !== 'ZAPI') {
      return { total: 0, offset, limit, messages: [] }
    }

    const lineKey = item.metadata.zApiInstanceId
    const [ids, total] = await Promise.all([
      this.cadence.queuedTickets(lineKey, limit, offset),
      this.cadence.waitingCount(lineKey),
    ])

    const rows = new Map(
      (await this.outbox.findByIds(ids)).map(row => [row.id, row]),
    )

    const waiting = ids
      .map((id, index) => ({ row: rows.get(id), position: offset + index + 1 }))
      .filter(
        (entry): entry is { row: WidgetOutboxRecord; position: number } =>
          entry.row !== undefined &&
          (entry.row.status === 'PENDING' || entry.row.status === 'SENDING'),
      )

    // Uma leitura por operador, não por mensagem: o mesmo operador responde várias.
    const operatorIds = [
      ...new Set(
        waiting
          .map(entry => entry.row)
          .filter(row => row.origin === 'OPERATOR' && row.operatorBitrixUserId)
          .map(row => row.operatorBitrixUserId as string),
      ),
    ]
    const names =
      this.resolveOperatorNames && operatorIds.length > 0
        ? await this.resolveOperatorNames(
            { domainName: context.customer.name, appCode: input.appCode },
            operatorIds,
          ).catch(() => new Map<string, string>())
        : new Map<string, string>()

    const messages: CadenceQueueItem[] = []
    for (const { row, position } of waiting) {
      messages.push({
        position,
        origin: row.origin,
        operatorName:
          row.origin === 'OPERATOR' && row.operatorBitrixUserId
            ? (names.get(row.operatorBitrixUserId) ?? null)
            : null,
        destination: row.destination,
        preview: previewOf(row),
        mediaType: row.kind === 'MEDIA' ? row.mediaType : null,
        enqueuedAt: row.createdAt.getTime(),
        waitUntil: row.cadenceWaitUntil?.getTime() ?? null,
      })
    }

    return { total, offset, limit, messages }
  }
}
