import { beforeEach, describe, expect, it, vi } from 'vitest'

/** O que o teste lê dos argumentos do cliente Prisma: só o `where`. */
type QueryArgs = {
  where: Record<string, unknown> & { AND?: Record<string, unknown>[] }
}

const { queryRawMock, findManyMock, findFirstMock, groupByMock } = vi.hoisted(
  () => ({
    queryRawMock: vi.fn<(query: Prisma.Sql) => Promise<unknown[]>>(),
    findManyMock: vi.fn<(args: QueryArgs) => Promise<unknown[]>>(),
    findFirstMock: vi.fn<(args: QueryArgs) => Promise<unknown>>(),
    groupByMock: vi.fn<(args: QueryArgs) => Promise<unknown[]>>(),
  }),
)

vi.mock('@/config/prisma', () => ({
  prisma: {
    $queryRaw: queryRawMock,
    thinkzapWidgetOutbox: {
      findMany: findManyMock,
      findFirst: findFirstMock,
      groupBy: groupByMock,
    },
  },
}))

import type { Prisma } from '@/prisma/client'
import {
  normalizeSendListFilters,
  type SendListFiltersInput,
} from '@/modules/thinkzap/domain/send-list-filters'
import { TRACKED_SEND_ORIGINS } from '@/modules/thinkzap/domain/send-notice'
import {
  PrismaSendListRepository,
  type SendListScope,
} from './prisma-send-list.repository'

const now = new Date('2026-11-27T12:00:00.000Z')
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

const sut = () => new PrismaSendListRepository(() => now)

const admin: SendListScope = {
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  onlyOperatorId: null,
}
const operator: SendListScope = { ...admin, onlyOperatorId: '7' }

const filtersOf = (input: SendListFiltersInput = {}) =>
  normalizeSendListFilters(input, now)

const dbRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'outbox-1',
  clientMessageId: 'client-1',
  instanceId: 'inst-1',
  subscriptionItemId: 'item-1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  destination: '5511999999999',
  text: 'Olá',
  entity: 'deal',
  entityId: '42',
  kind: 'TEXT',
  templateName: null,
  templateLanguage: null,
  templateParameters: null,
  templateButtonParameters: null,
  templateHeaderImageUrl: null,
  buttonPayload: null,
  status: 'SENT',
  providerMessageId: 'wamid-1',
  timelineNotifiedAt: null,
  attempts: 1,
  lastError: null,
  operatorBitrixUserId: '7',
  smsSenderCode: null,
  smsMessageId: null,
  origin: 'WIDGET',
  mediaType: null,
  mediaSource: null,
  fileName: null,
  caption: null,
  dispatchGroupId: null,
  partIndex: null,
  dispatchMeta: null,
  bitrixMessageId: null,
  bitrixChatId: null,
  originContext: null,
  sendNoticeId: null,
  deliveredAt: null,
  readAt: null,
  rejectedAt: null,
  failureCode: null,
  failureReason: null,
  queueSeq: null,
  cadenceWaitUntil: null,
  reprocessCount: 0,
  lastReprocessedAt: null,
  lastReprocessedBy: null,
  createdAt: daysAgo(1),
  updatedAt: daysAgo(1),
  sentAt: daysAgo(1),
  ...overrides,
})

/** As duas consultas cruas de `list`: a página e o total, nessa ordem. */
const rawQueries = () => queryRawMock.mock.calls.map(([query]) => query)

const pageQuery = () => rawQueries()[0] as Prisma.Sql
const countQuery = () => rawQueries()[1] as Prisma.Sql

function mockRaw(heads: unknown[], total: number) {
  queryRawMock.mockImplementation((query: Prisma.Sql) =>
    Promise.resolve(
      query.sql.includes('COUNT(*)') ? [{ total: BigInt(total) }] : heads,
    ),
  )
}

/** Predicado comum que toda leitura do cliente Prisma precisa carregar. */
const visibilityOf = (where: unknown) => {
  const and = (where as { AND: Record<string, unknown>[] }).AND
  return and[0] as Record<string, unknown>
}

describe('PrismaSendListRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findManyMock.mockResolvedValue([])
    mockRaw([], 0)
  })

  describe('list', () => {
    it('não interpola nenhum valor do usuário no texto do SQL', async () => {
      const filters = filtersOf({
        status: 'FAILED',
        line: 'item-zz9',
        destination: '+55 (11) 99091-017',
        senderId: 'sender-42',
        page: 3,
        limit: 15,
      })

      await sut().list(filters, {
        domainId: 'dom-xyz',
        appCode: 'app-abc',
        onlyOperatorId: null,
      })

      for (const query of rawQueries()) {
        for (const value of [
          'dom-xyz',
          'app-abc',
          'item-zz9',
          '551199091017',
          'sender-42',
          'FAILED',
        ]) {
          // `'FAILED'` aparece como literal fixo do CASE; o do usuário é parâmetro.
          if (value === 'FAILED') continue
          expect(query.sql).not.toContain(value)
        }
        expect(query.values).toEqual(
          expect.arrayContaining([
            'dom-xyz',
            'app-abc',
            'item-zz9',
            '%551199091017%',
            'sender-42',
            'FAILED',
          ]),
        )
      }
      expect(pageQuery().sql).toMatch(/LIMIT \? OFFSET \?/)
      expect(pageQuery().values.slice(-2)).toEqual([15, 30])
    })

    it('o status pedido entra como parâmetro do HAVING, não como texto', async () => {
      await sut().list(filtersOf({ status: 'partial' }), admin)

      expect(pageQuery().sql).toMatch(/HAVING CASE[\s\S]*END = \?/)
      expect(countQuery().sql).toMatch(/HAVING CASE[\s\S]*END = \?/)
      expect(pageQuery().values).toContain('PARTIAL')
    })

    it('sem status não calcula o CASE', async () => {
      await sut().list(filtersOf(), admin)

      expect(pageQuery().sql).not.toContain('HAVING')
      expect(countQuery().sql).not.toContain('HAVING')
    })

    it('aplica o filtro fixo: instalação, app, origens rastreadas e sem SMS', async () => {
      await sut().list(filtersOf(), admin)

      const sql = pageQuery().sql
      expect(sql).toContain('FROM core_thinkerszap_widget_outbox o')
      expect(sql).toContain('o.domain_id = ?')
      expect(sql).toContain('o.app_code = ?')
      expect(sql).toContain(
        `o.origin IN (${TRACKED_SEND_ORIGINS.map(() => '?').join(',')})`,
      )
      expect(sql).toContain('o.sms_message_id IS NULL')
      expect(pageQuery().values).toEqual(
        expect.arrayContaining([...TRACKED_SEND_ORIGINS]),
      )
    })

    it('agrupa por grupo do disparo e destino, sem função de janela', async () => {
      await sut().list(filtersOf({ status: 'READ' }), admin)

      for (const query of rawQueries()) {
        expect(query.sql).toContain(
          'GROUP BY COALESCE(o.dispatch_group_id, o.id), o.destination',
        )
        expect(query.sql).not.toMatch(/\bOVER\s*\(/i)
        expect(query.sql).not.toMatch(/ROW_NUMBER|RANK\(/i)
      }
      expect(pageQuery().sql).toContain(
        "SUBSTRING_INDEX(GROUP_CONCAT(o.id ORDER BY o.part_index, o.created_at, o.id SEPARATOR ','), ',', 1) AS headId",
      )
      expect(pageQuery().sql).toContain('ORDER BY firstAt DESC, headId DESC')
    })

    it('aplica o piso de 90 dias mesmo com filtro mais antigo', async () => {
      // Filtro montado à mão, sem passar pela normalização: o repositório não
      // pode confiar só nela.
      const filters = { ...filtersOf(), from: daysAgo(400) }

      await sut().list(filters, admin)

      expect(pageQuery().sql).toContain('o.created_at >= ?')
      expect(pageQuery().sql).toContain('o.created_at <= ?')
      expect(pageQuery().values).toContainEqual(daysAgo(90))
      expect(pageQuery().values).not.toContainEqual(daysAgo(400))
    })

    it('mantém o início pedido quando é mais recente que o piso', async () => {
      await sut().list(filtersOf({ from: daysAgo(3) }), admin)

      expect(pageQuery().values).toContainEqual(daysAgo(3))
    })

    it('o operador sempre filtra pelo próprio id, e o senderId não o troca', async () => {
      await sut().list(filtersOf({ senderId: '99' }), operator)

      for (const query of rawQueries()) {
        expect(query.sql).toContain('o.operator_bitrix_user_id = ?')
        expect(query.values).toContain('7')
        expect(query.values).not.toContain('99')
      }
    })

    it('o operador filtra pelo próprio id mesmo sem senderId', async () => {
      await sut().list(filtersOf(), operator)

      expect(pageQuery().sql).toContain('o.operator_bitrix_user_id = ?')
      expect(pageQuery().values).toContain('7')
    })

    it('o administrador filtra por remetente só quando pede', async () => {
      await sut().list(filtersOf(), admin)
      expect(pageQuery().sql).not.toContain('operator_bitrix_user_id')

      queryRawMock.mockClear()
      await sut().list(filtersOf({ senderId: '12' }), admin)
      expect(pageQuery().sql).toContain('o.operator_bitrix_user_id = ?')
      expect(pageQuery().values).toContain('12')
    })

    it('filtra linha e destinatário por parâmetro', async () => {
      await sut().list(
        filtersOf({ line: 'item-1', destination: '99091017' }),
        admin,
      )

      expect(pageQuery().sql).toContain('o.subscription_item_id = ?')
      expect(pageQuery().sql).toContain('o.destination LIKE ?')
      expect(pageQuery().values).toEqual(
        expect.arrayContaining(['item-1', '%99091017%']),
      )
    })

    it('lê as partes da página com o mesmo predicado e as agrupa por destino', async () => {
      mockRaw(
        [
          { headId: 'p-0', groupId: 'g-1', destination: '5511' },
          { headId: 'solo', groupId: null, destination: '5522' },
        ],
        7,
      )
      findManyMock.mockResolvedValue([
        dbRow({
          id: 'p-1',
          dispatchGroupId: 'g-1',
          partIndex: 1,
          destination: '5511',
          createdAt: daysAgo(2),
        }),
        dbRow({
          id: 'p-0',
          dispatchGroupId: 'g-1',
          partIndex: 0,
          destination: '5511',
          createdAt: daysAgo(2),
        }),
        // Mesmo grupo, outro destinatário: é outra linha da lista, fora da página.
        dbRow({
          id: 'p-x',
          dispatchGroupId: 'g-1',
          partIndex: 0,
          destination: '5599',
        }),
        dbRow({ id: 'solo', destination: '5522', createdAt: daysAgo(1) }),
      ])

      const page = await sut().list(filtersOf({ senderId: '7' }), operator)

      expect(page.total).toBe(7)
      expect(page.items.map(item => item.headId)).toEqual(['p-0', 'solo'])
      expect(page.items[0]?.parts.map(part => part.id)).toEqual(['p-0', 'p-1'])
      expect(page.items[0]?.createdAt).toEqual(daysAgo(2))
      expect(page.items[1]?.parts.map(part => part.id)).toEqual(['solo'])

      const where = findManyMock.mock.calls[0]?.[0]?.where
      expect(visibilityOf(where)).toEqual({
        domainId: 'domain-1',
        appCode: 'crmthink.thinkzap',
        origin: { in: [...TRACKED_SEND_ORIGINS] },
        smsMessageId: null,
        createdAt: { gte: daysAgo(7), lte: now },
        operatorBitrixUserId: '7',
      })
      expect(where?.AND?.[1]).toEqual({
        OR: [
          { dispatchGroupId: 'g-1', destination: '5511' },
          { id: 'solo', dispatchGroupId: null },
        ],
      })
    })

    it('página vazia não lê partes', async () => {
      mockRaw([], 0)

      const page = await sut().list(filtersOf(), admin)

      expect(page).toEqual({ items: [], total: 0 })
      expect(findManyMock).not.toHaveBeenCalled()
    })

    it('grupo apagado entre as leituras some da página', async () => {
      mockRaw([{ headId: 'gone', groupId: null, destination: '55' }], 1)
      findManyMock.mockResolvedValue([])

      const page = await sut().list(filtersOf(), admin)

      expect(page.items).toEqual([])
    })
  })

  describe('defesa em profundidade e ordem das partes', () => {
    it('reaplica só dígitos ao destinatário mesmo que o chamador não normalize', async () => {
      mockRaw([], 0)
      await sut().list({ ...filtersOf({}), destination: '99%_09' }, admin)

      expect(pageQuery().values).toContain('%9909%')
      expect(pageQuery().values).not.toContain('%99%_09%')
    })

    it('o head do JS segue o SQL: part_index nulo primeiro, depois data e id', async () => {
      mockRaw([{ headId: 'b', groupId: 'g-1', destination: '5511' }], 1)
      const at = daysAgo(1)
      findManyMock.mockResolvedValue([
        dbRow({
          id: 'z',
          dispatchGroupId: 'g-1',
          destination: '5511',
          partIndex: 0,
          createdAt: at,
        }),
        dbRow({
          id: 'b',
          dispatchGroupId: 'g-1',
          destination: '5511',
          partIndex: null,
          createdAt: at,
        }),
        dbRow({
          id: 'a',
          dispatchGroupId: 'g-1',
          destination: '5511',
          partIndex: null,
          createdAt: at,
        }),
      ])

      const page = await sut().list(filtersOf({}), admin)

      expect(page.items[0]?.parts.map(part => part.id)).toEqual(['a', 'b', 'z'])
      expect(page.items[0]?.headId).toBe('a')
    })
  })

  describe('CASE de status', () => {
    it('tem um ramo para cada estado, na precedência de summarizeRecipients', async () => {
      await sut().list(filtersOf({ status: 'SENT' }), admin)

      const sql = pageQuery().sql
      const order = [
        "THEN 'PARTIAL'",
        "THEN 'FAILED'",
        "THEN 'UNKNOWN'",
        "THEN 'WAITING'",
        "THEN 'READ'",
        "THEN 'DELIVERED'",
        "ELSE 'SENT'",
      ].map(branch => {
        const index = sql.indexOf(branch)
        expect(index, branch).toBeGreaterThan(-1)
        return index
      })
      expect(order).toEqual([...order].sort((a, b) => a - b))
    })

    it('espelha as condições de falha, enviada, fila, lido e entregue', async () => {
      await sut().list(filtersOf({ status: 'SENT' }), admin)

      const sql = pageQuery().sql
      const failed =
        "(o.status = 'FAILED' OR (o.rejected_at IS NOT NULL AND o.delivered_at IS NULL AND o.read_at IS NULL))"
      const sentOk =
        "(o.status = 'SENT' AND NOT (o.rejected_at IS NOT NULL AND o.delivered_at IS NULL AND o.read_at IS NULL))"
      expect(sql).toContain(
        `WHEN MAX(CASE WHEN ${failed} THEN 1 ELSE 0 END) = 1 AND MAX(CASE WHEN ${sentOk} THEN 1 ELSE 0 END) = 1 THEN 'PARTIAL'`,
      )
      expect(sql).toContain(
        `WHEN MAX(CASE WHEN ${failed} THEN 1 ELSE 0 END) = 1 THEN 'FAILED'`,
      )
      expect(sql).toContain(
        "WHEN MAX(CASE WHEN o.status = 'UNKNOWN' THEN 1 ELSE 0 END) = 1 THEN 'UNKNOWN'",
      )
      expect(sql).toContain(
        "WHEN MAX(CASE WHEN o.status IN ('PENDING', 'SENDING') THEN 1 ELSE 0 END) = 1 THEN 'WAITING'",
      )
      expect(sql).toContain(
        "WHEN MIN(CASE WHEN o.read_at IS NOT NULL THEN 1 ELSE 0 END) = 1 THEN 'READ'",
      )
      expect(sql).toContain(
        "WHEN MIN(CASE WHEN (o.delivered_at IS NOT NULL OR o.read_at IS NOT NULL) THEN 1 ELSE 0 END) = 1 THEN 'DELIVERED'",
      )
    })
  })

  describe('opções dos filtros', () => {
    const period = { from: daysAgo(200), to: now }

    it('lista as linhas do período com a mesma visibilidade e o piso de 90 dias', async () => {
      groupByMock.mockResolvedValue([
        { subscriptionItemId: 'item-1' },
        { subscriptionItemId: 'item-2' },
      ])

      const lines = await sut().listLineIds(operator, period)

      expect(lines).toEqual(['item-1', 'item-2'])
      const args = groupByMock.mock.calls[0]?.[0]
      expect(args).toMatchObject({
        by: ['subscriptionItemId'],
        where: {
          domainId: 'domain-1',
          createdAt: { gte: daysAgo(90), lte: now },
          operatorBitrixUserId: '7',
        },
      })
    })

    it('lista os remetentes só para o administrador, sem nulos', async () => {
      groupByMock.mockResolvedValue([
        { operatorBitrixUserId: '7' },
        { operatorBitrixUserId: '12' },
      ])

      expect(await sut().listSenderIds(admin, period)).toEqual(['7', '12'])
      const where = groupByMock.mock.calls[0]?.[0]?.where
      expect(where?.AND?.[1]).toEqual({ operatorBitrixUserId: { not: null } })
    })

    it('operador não recebe opções de remetente', async () => {
      expect(await sut().listSenderIds(operator, period)).toEqual([])
      expect(groupByMock).not.toHaveBeenCalled()
    })
  })

  describe('findDetail', () => {
    const detailWhere = () => findFirstMock.mock.calls[0]?.[0]?.where

    it('carrega o envio sem grupo com o predicado de visibilidade', async () => {
      findFirstMock.mockResolvedValue(dbRow({ id: 'solo' }))

      const detail = await sut().findDetail('solo', operator)

      expect(detail?.headId).toBe('solo')
      expect(detail?.parts.map(part => part.id)).toEqual(['solo'])
      expect(detailWhere()).toEqual({
        AND: [
          {
            domainId: 'domain-1',
            appCode: 'crmthink.thinkzap',
            origin: { in: [...TRACKED_SEND_ORIGINS] },
            smsMessageId: null,
            createdAt: { gte: daysAgo(90) },
            operatorBitrixUserId: '7',
          },
          { id: 'solo' },
        ],
      })
      expect(findManyMock).not.toHaveBeenCalled()
    })

    it('administrador não tem filtro de remetente no detalhe', async () => {
      findFirstMock.mockResolvedValue(null)

      await sut().findDetail('x', admin)

      expect(visibilityOf(detailWhere())).not.toHaveProperty(
        'operatorBitrixUserId',
      )
    })

    it('traz as partes irmãs do mesmo grupo e destino, com a mesma checagem', async () => {
      findFirstMock.mockResolvedValue(
        dbRow({ id: 'p-1', dispatchGroupId: 'g-1', partIndex: 1 }),
      )
      findManyMock.mockResolvedValue([
        dbRow({ id: 'p-1', dispatchGroupId: 'g-1', partIndex: 1 }),
        dbRow({ id: 'p-0', dispatchGroupId: 'g-1', partIndex: 0 }),
      ])

      const detail = await sut().findDetail('p-1', operator)

      expect(detail?.headId).toBe('p-0')
      expect(detail?.parts.map(part => part.id)).toEqual(['p-0', 'p-1'])
      const where = findManyMock.mock.calls[0]?.[0]?.where
      expect(visibilityOf(where)).toMatchObject({
        domainId: 'domain-1',
        operatorBitrixUserId: '7',
        smsMessageId: null,
      })
      expect(where?.AND?.[1]).toEqual({
        dispatchGroupId: 'g-1',
        destination: '5511999999999',
      })
    })

    // O mock não filtra: o banco é quem recusa. O teste garante que cada recusa
    // está no `where` e que a ausência de row vira `null`, igual a id inexistente.
    it.each([
      ['outro remetente', 'operatorBitrixUserId', '7'],
      ['outra instalação', 'domainId', 'domain-1'],
      ['outro app', 'appCode', 'crmthink.thinkzap'],
      ['mais de 90 dias', 'createdAt', { gte: daysAgo(90) }],
      ['origem não rastreada', 'origin', { in: [...TRACKED_SEND_ORIGINS] }],
      ['campanha de SMS', 'smsMessageId', null],
    ])('%s devolve null', async (_case, field, expected) => {
      findFirstMock.mockResolvedValue(null)

      expect(await sut().findDetail('outbox-1', operator)).toBeNull()
      expect(visibilityOf(detailWhere())[field]).toEqual(expected)
      expect(findManyMock).not.toHaveBeenCalled()
    })
  })
})
