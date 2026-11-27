import { prisma } from '@/config/prisma'
import { Prisma } from '@/prisma/client'
import {
  sendHistoryFloor,
  type SendListFilters,
  type SendListPeriod,
} from '@/modules/thinkzap/domain/send-list-filters'
import { TRACKED_SEND_ORIGINS } from '@/modules/thinkzap/domain/send-notice'
import {
  mapRow,
  type WidgetOutboxRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'

/**
 * Quem pede a lista. Vem do token, nunca da query string.
 *
 * `onlyOperatorId` é o usuário do token para quem não é administrador, e `null`
 * para o administrador: com ele preenchido, o filtro por remetente é **sempre**
 * esse e o `senderId` pedido é ignorado.
 */
export type SendListScope = {
  domainId: string
  appCode: string
  onlyOperatorId: string | null
}

/**
 * Um destinatário de um disparo: a unidade da aba Envios. O status mostrado não
 * vem daqui — o caso de uso o calcula das `parts` com `summarizeRecipients`.
 */
export type SendListItem = {
  /** Id da parte de menor `part_index`: o "id do envio" que o detalhe usa. */
  headId: string
  destination: string
  /** Data da parte mais antiga. */
  createdAt: Date
  parts: WidgetOutboxRecord[]
}

export type SendListPage = { items: SendListItem[]; total: number }

const TABLE = Prisma.raw('core_thinkerszap_widget_outbox')

/** Parte que conta como falha: espelha `isFailed` de `send-notice.ts`. */
const FAILED_PART = Prisma.sql`(o.status = 'FAILED' OR (o.rejected_at IS NOT NULL AND o.delivered_at IS NULL AND o.read_at IS NULL))`

/**
 * Parte que saiu e não falhou: `status = 'SENT'` e sem recusa sem entrega. É o
 * `part.status === 'SENT' && !isFailed(part)` de `summarize`.
 */
const SENT_OK_PART = Prisma.sql`(o.status = 'SENT' AND NOT (o.rejected_at IS NOT NULL AND o.delivered_at IS NULL AND o.read_at IS NULL))`

const anyPart = (condition: Prisma.Sql) =>
  Prisma.sql`MAX(CASE WHEN ${condition} THEN 1 ELSE 0 END) = 1`
const everyPart = (condition: Prisma.Sql) =>
  Prisma.sql`MIN(CASE WHEN ${condition} THEN 1 ELSE 0 END) = 1`

/**
 * O estado do destinatário calculado no banco, usado **só para filtrar e
 * contar**: o status exibido sai de `summarizeRecipients`, a fonte da verdade.
 *
 * ATENÇÃO: este `CASE` é cópia de `summarize` em `domain/send-notice.ts`, na
 * mesma precedência (falha > sem confirmação > na fila > lido > entregue >
 * enviado). Mudou lá, mude aqui junto — senão o filtro "Falhou" traz linha que a
 * tela mostra como "Enviado". Equivalência a conferir em staging com dados reais.
 *
 * `CASE WHEN ... THEN 1 ELSE 0` dentro de MAX/MIN, e não o booleano cru, para não
 * depender de como a versão do MariaDB agrega booleanos; nenhuma coluna da
 * condição de status é nula e as de data só aparecem em `IS [NOT] NULL`.
 */
export const recipientStateCase = Prisma.sql`CASE
  WHEN ${anyPart(FAILED_PART)} AND ${anyPart(SENT_OK_PART)} THEN 'PARTIAL'
  WHEN ${anyPart(FAILED_PART)} THEN 'FAILED'
  WHEN ${anyPart(Prisma.sql`o.status = 'UNKNOWN'`)} THEN 'UNKNOWN'
  WHEN ${anyPart(Prisma.sql`o.status IN ('PENDING', 'SENDING')`)} THEN 'WAITING'
  WHEN ${everyPart(Prisma.sql`o.read_at IS NOT NULL`)} THEN 'READ'
  WHEN ${everyPart(Prisma.sql`(o.delivered_at IS NOT NULL OR o.read_at IS NOT NULL)`)} THEN 'DELIVERED'
  ELSE 'SENT'
END`

type VisibilityInput = {
  scope: SendListScope
  /** Já com o piso de 90 dias aplicado. */
  from: Date
  to: Date | null
  subscriptionItemId?: string | null
  destination?: string | null
  senderId?: string | null
}

/**
 * Só dígitos, de novo: `send-list-filters` já normaliza, mas o repositório não
 * confia no chamador — `%` e `_` chegariam ao LIKE como curinga.
 */
function destinationDigits(input: VisibilityInput): string | null {
  const digits = (input.destination ?? '').replace(/\D/g, '')
  return digits === '' ? null : digits
}

/**
 * O remetente que entra no filtro: o do token para quem não é administrador,
 * sem exceção; o pedido só vale para o administrador.
 */
function operatorFilter(input: VisibilityInput): string | null {
  return input.scope.onlyOperatorId ?? input.senderId ?? null
}

/**
 * O `WHERE` das rows que a aba pode mostrar. Tem gêmeo em `visibleWhere`: as
 * partes da página são lidas com o mesmo predicado, para o estado mostrado ser
 * calculado sobre as mesmas rows que o `CASE` agregou.
 */
function visibleSql(input: VisibilityInput): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`o.domain_id = ${input.scope.domainId}`,
    Prisma.sql`o.app_code = ${input.scope.appCode}`,
    // Espelha `isTrackedSend`: a campanha de SMS usa a origem `WIDGET`.
    Prisma.sql`o.origin IN (${Prisma.join([...TRACKED_SEND_ORIGINS])})`,
    Prisma.sql`o.sms_message_id IS NULL`,
    Prisma.sql`o.created_at >= ${input.from}`,
  ]
  if (input.to) conditions.push(Prisma.sql`o.created_at <= ${input.to}`)
  if (input.subscriptionItemId) {
    conditions.push(
      Prisma.sql`o.subscription_item_id = ${input.subscriptionItemId}`,
    )
  }
  // Só dígitos (normalizado em `send-list-filters`), mas mesmo assim parâmetro.
  const destination = destinationDigits(input)
  if (destination) {
    conditions.push(Prisma.sql`o.destination LIKE ${`%${destination}%`}`)
  }
  const operator = operatorFilter(input)
  if (operator !== null) {
    conditions.push(Prisma.sql`o.operator_bitrix_user_id = ${operator}`)
  }
  return Prisma.join(conditions, ' AND ')
}

/** Gêmeo de `visibleSql` no cliente Prisma; mude os dois juntos. */
function visibleWhere(
  input: VisibilityInput,
): Prisma.ThinkzapWidgetOutboxWhereInput {
  const operator = operatorFilter(input)
  const destination = destinationDigits(input)
  return {
    domainId: input.scope.domainId,
    appCode: input.scope.appCode,
    origin: { in: [...TRACKED_SEND_ORIGINS] },
    smsMessageId: null,
    createdAt: input.to
      ? { gte: input.from, lte: input.to }
      : { gte: input.from },
    ...(input.subscriptionItemId
      ? { subscriptionItemId: input.subscriptionItemId }
      : {}),
    ...(destination ? { destination: { contains: destination } } : {}),
    ...(operator !== null ? { operatorBitrixUserId: operator } : {}),
  }
}

/** Piso de 90 dias reaplicado aqui: o repositório não confia só no filtro. */
function boundedFrom(from: Date, now: Date): Date {
  const floor = sendHistoryFloor(now)
  return from > floor ? from : floor
}

type HeadRow = {
  headId: string
  groupId: string | null
  destination: string
}

type CountRow = { total: bigint | number | string }

const groupKey = (groupId: string | null, id: string, destination: string) =>
  `${groupId ?? id}\u0000${destination}`

/**
 * A mesma ordem do `ORDER BY o.part_index, o.created_at, o.id` do SQL: `part_index`
 * nulo vem primeiro (como no MariaDB), e o id desempata. Sem isso o `headId` do JS
 * poderia discordar do SQL, e o detalhe abriria outra parte.
 */
const byPartOrder = (a: WidgetOutboxRecord, b: WidgetOutboxRecord) => {
  if (a.partIndex !== b.partIndex) {
    if (a.partIndex === null) return -1
    if (b.partIndex === null) return 1
    return a.partIndex - b.partIndex
  }
  const byDate = a.createdAt.getTime() - b.createdAt.getTime()
  if (byDate !== 0) return byDate
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function toItem(parts: WidgetOutboxRecord[]): SendListItem | null {
  const sorted = [...parts].sort(byPartOrder)
  const head = sorted[0]
  if (!head) return null
  const createdAt = sorted.reduce(
    (oldest, part) => (part.createdAt < oldest ? part.createdAt : oldest),
    head.createdAt,
  )
  return {
    headId: head.id,
    destination: head.destination,
    createdAt,
    parts: sorted,
  }
}

/**
 * Leitura da aba Envios sobre o outbox.
 *
 * A unidade é `(COALESCE(dispatch_group_id, id), destination)`: um disparo de
 * robô ou um envio com anexo tem várias rows por destinatário, e paginar rows
 * quebraria a contagem. Agrupa com `GROUP BY` e agregados condicionais — sem
 * função de janela, porque a versão do MariaDB de produção não está confirmada.
 */
export class PrismaSendListRepository {
  constructor(private readonly now: () => Date = () => new Date()) {}

  async list(
    filters: SendListFilters,
    scope: SendListScope,
  ): Promise<SendListPage> {
    const visibility: VisibilityInput = {
      scope,
      from: boundedFrom(filters.from, this.now()),
      to: filters.to,
      subscriptionItemId: filters.subscriptionItemId,
      destination: filters.destination,
      senderId: filters.senderId,
    }
    const where = visibleSql(visibility)
    const having = filters.status
      ? Prisma.sql`HAVING ${recipientStateCase} = ${filters.status}`
      : Prisma.empty
    const offset = (filters.page - 1) * filters.limit

    // Head: a parte de menor `part_index`. GROUP_CONCAT em vez de ROW_NUMBER pela
    // portabilidade; ids são UUID (sem vírgula), e o corte de
    // `group_concat_max_len` só atinge o fim da lista, nunca o primeiro id.
    const pageQuery = Prisma.sql`SELECT
  SUBSTRING_INDEX(GROUP_CONCAT(o.id ORDER BY o.part_index, o.created_at, o.id SEPARATOR ','), ',', 1) AS headId,
  MAX(o.dispatch_group_id) AS groupId,
  o.destination AS destination,
  MIN(o.created_at) AS firstAt
FROM ${TABLE} o
WHERE ${where}
GROUP BY COALESCE(o.dispatch_group_id, o.id), o.destination
${having}
ORDER BY firstAt DESC, headId DESC
LIMIT ${filters.limit} OFFSET ${offset}`

    const countQuery = Prisma.sql`SELECT COUNT(*) AS total FROM (
  SELECT 1 AS one
  FROM ${TABLE} o
  WHERE ${where}
  GROUP BY COALESCE(o.dispatch_group_id, o.id), o.destination
  ${having}
) g`

    const [heads, counted] = await Promise.all([
      prisma.$queryRaw<HeadRow[]>(pageQuery),
      prisma.$queryRaw<CountRow[]>(countQuery),
    ])
    const total = Number(counted[0]?.total ?? 0)
    if (heads.length === 0) return { items: [], total }

    // Grupo **e** destino: um disparo de robô para mil telefones não pode trazer
    // as mil rows para mostrar os vinte da página.
    const rows = await prisma.thinkzapWidgetOutbox.findMany({
      where: {
        AND: [
          visibleWhere(visibility),
          {
            OR: heads.map(head =>
              head.groupId
                ? {
                    dispatchGroupId: head.groupId,
                    destination: head.destination,
                  }
                : { id: head.headId, dispatchGroupId: null },
            ),
          },
        ],
      },
    })

    const partsByKey = new Map<string, WidgetOutboxRecord[]>()
    for (const record of rows.map(mapRow)) {
      const key = groupKey(
        record.dispatchGroupId,
        record.id,
        record.destination,
      )
      const parts = partsByKey.get(key)
      if (parts) parts.push(record)
      else partsByKey.set(key, [record])
    }

    // A ordem é a do SQL. Grupo que a retenção apagou entre as duas leituras
    // some da página em vez de aparecer vazio.
    const items = heads.flatMap(head => {
      const item = toItem(
        partsByKey.get(groupKey(head.groupId, head.headId, head.destination)) ??
          [],
      )
      return item ? [item] : []
    })

    return { items, total }
  }

  /** Linhas com envio no período, para as opções do filtro. */
  async listLineIds(
    scope: SendListScope,
    period: SendListPeriod,
  ): Promise<string[]> {
    const rows = await prisma.thinkzapWidgetOutbox.groupBy({
      by: ['subscriptionItemId'],
      where: visibleWhere({
        scope,
        from: boundedFrom(period.from, this.now()),
        to: period.to,
      }),
      orderBy: { subscriptionItemId: 'asc' },
    })
    return rows.map(row => row.subscriptionItemId)
  }

  /**
   * Remetentes com envio no período, só para o administrador: o operador vê
   * apenas os próprios envios e não tem o filtro.
   */
  async listSenderIds(
    scope: SendListScope,
    period: SendListPeriod,
  ): Promise<string[]> {
    if (scope.onlyOperatorId !== null) return []
    const rows = await prisma.thinkzapWidgetOutbox.groupBy({
      by: ['operatorBitrixUserId'],
      where: {
        AND: [
          visibleWhere({
            scope,
            from: boundedFrom(period.from, this.now()),
            to: period.to,
          }),
          { operatorBitrixUserId: { not: null } },
        ],
      },
      orderBy: { operatorBitrixUserId: 'asc' },
    })
    return rows.flatMap(row =>
      row.operatorBitrixUserId ? [row.operatorBitrixUserId] : [],
    )
  }

  /**
   * O envio de um destinatário pelo id de qualquer parte. Tudo que o usuário não
   * pode ver — outra instalação, outro remetente, fora dos 90 dias, origem não
   * rastreada, campanha de SMS — volta `null`, igual a id inexistente, para não
   * revelar que o envio existe.
   */
  async findDetail(
    id: string,
    scope: SendListScope,
  ): Promise<SendListItem | null> {
    const visibility = visibleWhere({
      scope,
      from: sendHistoryFloor(this.now()),
      to: null,
    })

    const row = await prisma.thinkzapWidgetOutbox.findFirst({
      where: { AND: [visibility, { id }] },
    })
    if (!row) return null
    const record = mapRow(row)
    if (record.dispatchGroupId === null) return toItem([record])

    // As partes irmãs herdam a mesma checagem de visibilidade.
    const siblings = await prisma.thinkzapWidgetOutbox.findMany({
      where: {
        AND: [
          visibility,
          {
            dispatchGroupId: record.dispatchGroupId,
            destination: record.destination,
          },
        ],
      },
    })
    const parts = siblings.map(mapRow)
    return toItem(parts.some(part => part.id === id) ? parts : [record])
  }
}
