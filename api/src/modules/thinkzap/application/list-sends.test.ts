import { describe, expect, it, vi } from 'vitest'
import { outboxRow } from '@/modules/thinkzap/application/helpers/outbox-row.fixture'
import { ListSends } from '@/modules/thinkzap/application/list-sends'
import type { InstallationLocaleRepository } from '@/modules/thinkzap/domain/ports/installation-locale.port'
import type {
  SendLineCatalog,
  SendListReader,
  SendSenderNameResolver,
} from '@/modules/thinkzap/domain/ports/send-list-lookups.port'
import { normalizeSendListFilters } from '@/modules/thinkzap/domain/send-list-filters'
import type { SendListItem } from '@/modules/thinkzap/infra/persistence/repositories/prisma-send-list.repository'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'

const now = new Date('2026-11-27T12:00:00.000Z')
const at = (hours: number) => new Date(now.getTime() - hours * 3_600_000)

const itemOf = (
  parts: WidgetOutboxRecord[],
  overrides: Partial<SendListItem> = {},
): SendListItem => ({
  headId: parts[0]?.id ?? 'row-1',
  destination: parts[0]?.destination ?? '5511999999999',
  createdAt: at(2),
  parts,
  ...overrides,
})

const identity = {
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  bitrixUserId: '7',
}
const filtersOf = (
  input: Parameters<typeof normalizeSendListFilters>[0] = {},
) => normalizeSendListFilters(input, now)

function build(
  options: {
    items?: SendListItem[]
    total?: number
    locale?: 'pt' | 'en' | 'es'
    lineIds?: string[]
    senderIds?: string[]
    names?: Map<string, string> | Error
    catalog?: { id: string; name: string }[]
  } = {},
) {
  const sends = {
    list: vi.fn<SendListReader['list']>().mockResolvedValue({
      items: options.items ?? [],
      total: options.total ?? options.items?.length ?? 0,
    }),
    listLineIds: vi
      .fn<SendListReader['listLineIds']>()
      .mockResolvedValue(options.lineIds ?? []),
    listSenderIds: vi
      .fn<SendListReader['listSenderIds']>()
      .mockResolvedValue(options.senderIds ?? []),
    findDetail: vi.fn<SendListReader['findDetail']>(),
  }
  const locales = {
    byAppId: vi.fn<InstallationLocaleRepository['byAppId']>(),
    byInstallation: vi
      .fn<InstallationLocaleRepository['byInstallation']>()
      .mockResolvedValue(options.locale ?? 'pt'),
    save: vi.fn<InstallationLocaleRepository['save']>(),
  }
  const lines = {
    listLines: vi
      .fn<SendLineCatalog['listLines']>()
      .mockResolvedValue(options.catalog ?? [{ id: 'line-1', name: 'Vendas' }]),
  }
  const names = options.names ?? new Map<string, string>()
  const senderNames = {
    resolveNames: vi
      .fn<SendSenderNameResolver['resolveNames']>()
      .mockImplementation(() =>
        names instanceof Error ? Promise.reject(names) : Promise.resolve(names),
      ),
  }
  const sut = new ListSends(sends, locales, lines, senderNames)
  return { sut, sends, locales, lines, senderNames }
}

describe('ListSends', () => {
  describe('perfil', () => {
    it('administrador consulta sem filtro de operador e pode filtrar por remetente', async () => {
      const { sut, sends } = build()

      await sut.execute({
        ...identity,
        isAdmin: true,
        filters: filtersOf({ senderId: '99' }),
      })

      expect(sends.list).toHaveBeenCalledWith(
        expect.objectContaining({ senderId: '99' }),
        {
          domainId: 'domain-1',
          appCode: 'crmthink.thinkzap',
          onlyOperatorId: null,
        },
      )
    })

    it('operador fica preso ao próprio id e o senderId pedido é ignorado', async () => {
      const { sut, sends } = build()

      await sut.execute({
        ...identity,
        isAdmin: false,
        filters: filtersOf({ senderId: '99' }),
      })

      const [filters, scope] = sends.list.mock.calls[0] ?? []
      expect(scope?.onlyOperatorId).toBe('7')
      expect(filters?.senderId).toBeNull()
    })

    it('operador não recebe as opções de remetente nem as pede com nomes', async () => {
      const { sut, senderNames } = build({ senderIds: ['1', '2'] })

      const out = await sut.execute({
        ...identity,
        isAdmin: false,
        filters: filtersOf(),
      })

      expect(out.senders).toEqual([])
      // Página vazia e sem opções para o perfil: nada a resolver.
      expect(senderNames.resolveNames).not.toHaveBeenCalled()
    })

    it('robô sem usuário: o operador o recebe do repositório vazio e o administrador o vê com remetente nulo', async () => {
      const robot = outboxRow({
        id: 'robot-1',
        origin: 'ROBOT_MESSAGE',
        operatorBitrixUserId: null,
      })
      const admin = build({ items: [itemOf([robot])] })
      const operator = build({ items: [] })

      const asAdmin = await admin.sut.execute({
        ...identity,
        isAdmin: true,
        filters: filtersOf(),
      })
      const asOperator = await operator.sut.execute({
        ...identity,
        isAdmin: false,
        filters: filtersOf(),
      })

      expect(asAdmin.items[0]).toMatchObject({
        origin: 'robot',
        sender: { id: null, name: null },
      })
      expect(admin.sends.list.mock.calls[0]?.[1].onlyOperatorId).toBeNull()
      expect(operator.sends.list.mock.calls[0]?.[1].onlyOperatorId).toBe('7')
      expect(asOperator.items).toEqual([])
    })
  })

  describe('nomes de remetente', () => {
    it('uma única chamada em lote para a página e as opções', async () => {
      const items = ['1', '2', '3'].map(id =>
        itemOf([
          outboxRow({
            id: `row-${id}`,
            operatorBitrixUserId: id,
          }),
        ]),
      )
      const { sut, senderNames } = build({
        items,
        senderIds: ['1', '2', '3', '4'],
        names: new Map([
          ['1', 'Ana'],
          ['4', 'Duda'],
        ]),
      })

      const out = await sut.execute({
        ...identity,
        isAdmin: true,
        filters: filtersOf(),
      })

      expect(senderNames.resolveNames).toHaveBeenCalledTimes(1)
      expect(senderNames.resolveNames.mock.calls[0]?.[0].sort()).toEqual([
        '1',
        '2',
        '3',
        '4',
      ])
      expect(out.items.map(item => item.sender.name)).toEqual([
        'Ana',
        null,
        null,
      ])
      expect(out.senders).toEqual([
        { id: '1', name: 'Ana' },
        { id: '2', name: null },
        { id: '3', name: null },
        { id: '4', name: 'Duda' },
      ])
    })

    it('Bitrix fora do ar: a lista volta com nomes nulos e sem lançar', async () => {
      const { sut } = build({
        items: [itemOf([outboxRow()])],
        senderIds: ['7'],
        names: new Error('Bitrix 503'),
      })

      const out = await sut.execute({
        ...identity,
        isAdmin: true,
        filters: filtersOf(),
      })

      expect(out.items).toHaveLength(1)
      expect(out.items[0]?.sender).toEqual({ id: '7', name: null })
      expect(out.senders).toEqual([{ id: '7', name: null }])
    })

    it('sem remetentes não chama o Bitrix', async () => {
      const robot = outboxRow({ operatorBitrixUserId: null })
      const { sut, senderNames } = build({ items: [itemOf([robot])] })

      await sut.execute({ ...identity, isAdmin: true, filters: filtersOf() })

      expect(senderNames.resolveNames).not.toHaveBeenCalled()
    })
  })

  describe('linhas', () => {
    it('nome da linha vem do contexto; id desconhecido vira o próprio id', async () => {
      const { sut } = build({
        items: [
          itemOf([outboxRow({ id: 'a', subscriptionItemId: 'line-1' })]),
          itemOf([outboxRow({ id: 'b', subscriptionItemId: 'gone-9' })]),
        ],
        lineIds: ['line-1', 'gone-9'],
      })

      const out = await sut.execute({
        ...identity,
        isAdmin: true,
        filters: filtersOf(),
      })

      expect(out.items.map(item => item.line)).toEqual([
        { id: 'line-1', name: 'Vendas' },
        { id: 'gone-9', name: 'gone-9' },
      ])
      expect(out.lines).toEqual([
        { id: 'gone-9', name: 'gone-9' },
        { id: 'line-1', name: 'Vendas' },
      ])
    })
  })

  describe('status e motivo', () => {
    const cases: [string, Partial<WidgetOutboxRecord>, string][] = [
      ['WAITING', { status: 'PENDING', sentAt: null }, 'WAITING'],
      ['SENT', {}, 'SENT'],
      ['DELIVERED', { deliveredAt: at(1) }, 'DELIVERED'],
      ['READ', { deliveredAt: at(1), readAt: at(1) }, 'READ'],
      ['FAILED', { status: 'FAILED', lastError: 'boom' }, 'FAILED'],
      ['UNKNOWN', { status: 'UNKNOWN', lastError: null }, 'UNKNOWN'],
    ]

    it.each(cases)('mapeia %s', async (_name, overrides, expected) => {
      const { sut } = build({ items: [itemOf([outboxRow(overrides)])] })

      const out = await sut.execute({
        ...identity,
        isAdmin: true,
        filters: filtersOf(),
      })

      expect(out.items[0]?.status).toBe(expected)
    })

    it('mapeia PARTIAL: texto saiu e o anexo falhou', async () => {
      const parts = [
        outboxRow({ id: 'p0', partIndex: 0, dispatchGroupId: 'g' }),
        outboxRow({
          id: 'p1',
          partIndex: 1,
          dispatchGroupId: 'g',
          kind: 'MEDIA',
          status: 'FAILED',
          lastError: 'arquivo',
        }),
      ]
      const { sut } = build({ items: [itemOf(parts)] })

      const out = await sut.execute({
        ...identity,
        isAdmin: true,
        filters: filtersOf(),
      })

      expect(out.items[0]).toMatchObject({
        status: 'PARTIAL',
        kind: 'attachment',
        failureReason: 'arquivo',
      })
    })

    it('não refiltra por status em memória: o que o SQL devolveu aparece', async () => {
      const { sut } = build({
        items: [itemOf([outboxRow()])],
        total: 41,
      })

      const out = await sut.execute({
        ...identity,
        isAdmin: true,
        filters: filtersOf({ status: 'FAILED' }),
      })

      expect(out.items).toHaveLength(1)
      expect(out.total).toBe(41)
    })

    it('sem falha não traz motivo', async () => {
      const { sut } = build({
        items: [itemOf([outboxRow({ deliveredAt: at(1) })])],
      })

      const out = await sut.execute({
        ...identity,
        isAdmin: true,
        filters: filtersOf(),
      })

      expect(out.items[0]?.failureReason).toBeNull()
    })

    const rejected = outboxRow({
      rejectedAt: at(1),
      failureCode: '131047',
      failureReason: 'Re-engagement message',
    })

    it.each([
      ['pt', '24 horas'],
      ['en', '24'],
      ['es', '24'],
    ] as const)('traduz o motivo da Meta em %s', async (locale, fragment) => {
      const { sut } = build({ items: [itemOf([rejected])], locale })

      const out = await sut.execute({
        ...identity,
        isAdmin: true,
        filters: filtersOf(),
      })

      expect(out.items[0]?.status).toBe('FAILED')
      expect(out.items[0]?.failureReason).toContain(fragment)
    })

    it('o motivo muda com o idioma da instalação', async () => {
      const reasons = await Promise.all(
        (['pt', 'en', 'es'] as const).map(async locale => {
          const { sut } = build({ items: [itemOf([rejected])], locale })
          const out = await sut.execute({
            ...identity,
            isAdmin: true,
            filters: filtersOf(),
          })
          return out.items[0]?.failureReason
        }),
      )

      expect(new Set(reasons).size).toBe(3)
    })

    it.each([
      ['pt', 'motivo não informado'],
      ['en', 'reason not reported'],
      ['es', 'motivo no informado'],
    ] as const)(
      'falha sem motivo registrado usa a frase genérica em %s',
      async (locale, fragment) => {
        const { sut } = build({
          items: [itemOf([outboxRow({ status: 'FAILED', lastError: null })])],
          locale,
        })

        const out = await sut.execute({
          ...identity,
          isAdmin: true,
          filters: filtersOf(),
        })

        expect(out.items[0]?.failureReason).toContain(fragment)
      },
    )
  })

  describe('sem confirmação, catálogo e opções', () => {
    it.each([
      ['pt', 'ANTES de reenviar'],
      ['en', 'BEFORE resending'],
      ['es', 'ANTES de reenviar'],
    ] as const)(
      'UNKNOWN nunca mostra o erro cru (%s)',
      async (locale, fragment) => {
        const unknown = outboxRow({
          status: 'UNKNOWN',
          lastError: 'timeout of 30000ms exceeded',
        })
        const { sut } = build({ items: [itemOf([unknown])], locale })

        const out = await sut.execute({
          ...identity,
          isAdmin: true,
          filters: filtersOf(),
        })

        expect(out.items[0]?.status).toBe('UNKNOWN')
        expect(out.items[0]?.failureReason).toContain(fragment)
        expect(out.items[0]?.failureReason).not.toContain('timeout')
        expect(out.items[0]?.hasUnconfirmed).toBe(true)
      },
    )

    it('falha com outra parte sem confirmação mantém o aviso hasUnconfirmed', async () => {
      const parts = [
        outboxRow({
          id: 'p0',
          partIndex: 0,
          dispatchGroupId: 'g',
          status: 'FAILED',
          lastError: 'x',
        }),
        outboxRow({
          id: 'p1',
          partIndex: 1,
          dispatchGroupId: 'g',
          status: 'UNKNOWN',
        }),
      ]
      const { sut } = build({ items: [itemOf(parts)] })

      const out = await sut.execute({
        ...identity,
        isAdmin: true,
        filters: filtersOf(),
      })

      expect(out.items[0]).toMatchObject({
        status: 'FAILED',
        hasUnconfirmed: true,
      })
    })

    it('envio sem parte desconhecida tem hasUnconfirmed falso', async () => {
      const { sut } = build({ items: [itemOf([outboxRow()])] })

      const out = await sut.execute({
        ...identity,
        isAdmin: true,
        filters: filtersOf(),
      })

      expect(out.items[0]?.hasUnconfirmed).toBe(false)
    })

    it('catálogo de linhas falhando não derruba a lista: id vira o nome', async () => {
      const { sut, lines } = build({
        items: [itemOf([outboxRow()])],
        lineIds: ['line-1'],
      })
      lines.listLines.mockRejectedValue(new Error('Bitrix fora'))

      const out = await sut.execute({
        ...identity,
        isAdmin: true,
        filters: filtersOf(),
      })

      expect(out.items[0]?.line).toEqual({ id: 'line-1', name: 'line-1' })
      expect(out.lines).toEqual([{ id: 'line-1', name: 'line-1' }])
    })

    it('operador só recebe as linhas dos próprios envios, com nome do catálogo', async () => {
      const { sut } = build({
        catalog: [
          { id: 'line-1', name: 'Vendas' },
          { id: 'line-2', name: 'Suporte' },
        ],
        lineIds: ['line-2'],
      })

      const operator = await sut.execute({
        ...identity,
        isAdmin: false,
        filters: filtersOf(),
      })

      expect(operator.lines).toEqual([{ id: 'line-2', name: 'Suporte' }])
    })

    it('administrador recebe o catálogo inteiro', async () => {
      const { sut } = build({
        catalog: [
          { id: 'line-1', name: 'Vendas' },
          { id: 'line-2', name: 'Suporte' },
        ],
        lineIds: ['line-2'],
      })

      const admin = await sut.execute({
        ...identity,
        isAdmin: true,
        filters: filtersOf(),
      })

      expect(admin.lines.map(line => line.id).sort()).toEqual([
        'line-1',
        'line-2',
      ])
    })
  })

  describe('kind e origem', () => {
    it.each([
      [{ kind: 'TEXT' }, 'text'],
      [{ kind: 'TEMPLATE', templateName: 't' }, 'template'],
      [{ kind: 'INTERACTIVE_BUTTON' }, 'buttons'],
      [{ kind: 'MEDIA' }, 'attachment'],
    ] as const)('mapeia %j', async (overrides, expected) => {
      const { sut } = build({
        items: [itemOf([outboxRow({ ...overrides })])],
      })

      const out = await sut.execute({
        ...identity,
        isAdmin: true,
        filters: filtersOf(),
      })

      expect(out.items[0]?.kind).toBe(expected)
    })

    it('texto com anexo no mesmo grupo é anexo', async () => {
      const parts = [
        outboxRow({ id: 'p0', partIndex: 0, dispatchGroupId: 'g' }),
        outboxRow({
          id: 'p1',
          partIndex: 1,
          dispatchGroupId: 'g',
          kind: 'MEDIA',
        }),
      ]
      const { sut } = build({ items: [itemOf(parts)] })

      const out = await sut.execute({
        ...identity,
        isAdmin: true,
        filters: filtersOf(),
      })

      expect(out.items[0]?.kind).toBe('attachment')
    })

    it('origem de widget e de robô', async () => {
      const { sut } = build({
        items: [
          itemOf([outboxRow({ id: 'w', origin: 'WIDGET_ATTACHMENT' })]),
          itemOf([outboxRow({ id: 'r', origin: 'ROBOT_TEMPLATE' })]),
        ],
      })

      const out = await sut.execute({
        ...identity,
        isAdmin: true,
        filters: filtersOf(),
      })

      expect(out.items.map(item => item.origin)).toEqual(['widget', 'robot'])
    })
  })

  it('devolve o envelope da página', async () => {
    const { sut } = build({
      items: [itemOf([outboxRow()])],
      total: 31,
    })

    const out = await sut.execute({
      ...identity,
      isAdmin: true,
      filters: filtersOf({ page: 2, limit: 10 }),
    })

    expect(out).toMatchObject({
      total: 31,
      page: 2,
      limit: 10,
      retentionDays: 90,
    })
    expect(out.items[0]).toMatchObject({
      id: 'row-1',
      createdAt: at(2).toISOString(),
      destination: '5511999999999',
    })
  })
})
