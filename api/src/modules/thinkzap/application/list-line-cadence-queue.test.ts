import { describe, expect, it, vi } from 'vitest'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import {
  ListLineCadenceQueue,
  type ResolveOperatorNames,
} from './list-line-cadence-queue'

const zapi: SubscriptionItem = {
  id: 'i1',
  name: 'L',
  subscription: 'sub-1',
  status: 'active',
  settings: DEFAULT_CONNECTOR_SETTINGS,
  vinculatedChannel: null,
  metadata: { provider: 'ZAPI', zApiInstanceId: 'Z-1', zApiInstanceToken: 't' },
}

const T0 = Date.parse('2026-10-21T13:00:00.000Z')

const row = (id: string, over: Partial<WidgetOutboxRecord> = {}) =>
  ({
    id,
    status: 'PENDING',
    origin: 'WIDGET',
    destination: '5511999999999',
    kind: 'TEXT',
    text: `texto ${id}`,
    caption: null,
    fileName: null,
    mediaType: null,
    createdAt: new Date(T0),
    cadenceWaitUntil: null,
    ...over,
  }) as WidgetOutboxRecord

function makeSut(
  item: SubscriptionItem,
  tickets: string[],
  rows: WidgetOutboxRecord[],
  total = tickets.length,
  resolveOperatorNames: ResolveOperatorNames | null = null,
) {
  const cadence = {
    queuedTickets: vi.fn((_line: string, limit?: number) =>
      Promise.resolve(tickets.slice(0, limit)),
    ),
    waitingCount: vi.fn(() => Promise.resolve(total)),
  }
  const outbox = {
    // Ordem do banco embaralhada: a lista tem de seguir a da fila.
    findByIds: vi.fn((ids: string[]) =>
      Promise.resolve(rows.filter(r => ids.includes(r.id)).reverse()),
    ),
  }
  const context = {
    execute: vi.fn().mockResolvedValue({
      customer: { id: 'domain-1', name: 'acme', memberId: 'm' },
      aplication: { id: 'app-1', spaId: '42' },
      subscriptions: [
        {
          id: 'sub-1',
          status: 'active',
          currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
          items: [item],
        },
      ],
    }),
  }
  const sut = new ListLineCadenceQueue(
    context as never,
    cadence as never,
    outbox,
    resolveOperatorNames,
  )
  return {
    sut,
    cadence,
    run: () =>
      sut.execute({
        subscriptionItemId: 'i1',
        domainId: 'domain-1',
        appCode: 'app',
      }),
  }
}

describe('ListLineCadenceQueue', () => {
  it('Pausa com mensagens na fila: lista na ordem de saída, com origem, trecho e previsão', async () => {
    const pausa = new Date(T0 + 340_000)
    const { run } = makeSut(
      zapi,
      ['op', 'r1', 'r2'],
      [
        row('op', {
          origin: 'OPERATOR',
          text: 'Bom dia!',
          cadenceWaitUntil: pausa,
        }),
        row('r1', { origin: 'ROBOT_MESSAGE', cadenceWaitUntil: pausa }),
        row('r2', { origin: 'ROBOT_MESSAGE' }),
      ],
    )

    const listing = await run()

    expect(listing.total).toBe(3)
    expect(
      listing.messages.map(m => [m.position, m.origin, m.preview]),
    ).toEqual([
      [1, 'OPERATOR', 'Bom dia!'],
      [2, 'ROBOT_MESSAGE', 'texto r1'],
      [3, 'ROBOT_MESSAGE', 'texto r2'],
    ])
    expect(listing.messages[0]).toMatchObject({
      destination: '5511999999999',
      enqueuedAt: T0,
      waitUntil: pausa.getTime(),
    })
    expect(listing.messages[2]!.waitUntil).toBeNull()
  })

  it('Mais de 50 aguardando: lista as 50 primeiras e devolve o total', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `m${i}`)
    const { run, cadence } = makeSut(
      zapi,
      ids,
      ids.map(id => row(id)),
    )

    const listing = await run()

    expect(cadence.queuedTickets).toHaveBeenCalledWith('Z-1', 50)
    expect(listing.messages).toHaveLength(50)
    expect(listing.total).toBe(120)
  })

  it('mídia sem legenda mostra o nome do arquivo; sem nome, nenhum trecho', async () => {
    const { run } = makeSut(
      zapi,
      ['a', 'b'],
      [
        row('a', {
          kind: 'MEDIA',
          text: '',
          mediaType: 'document',
          fileName: 'contrato.pdf',
        }),
        row('b', { kind: 'MEDIA', text: '', mediaType: 'image' }),
      ],
    )

    const { messages } = await run()

    expect(messages.map(m => [m.preview, m.mediaType])).toEqual([
      ['contrato.pdf', 'document'],
      [null, 'image'],
    ])
  })

  it('texto longo é cortado', async () => {
    const { run } = makeSut(zapi, ['a'], [row('a', { text: 'x'.repeat(200) })])

    const { messages } = await run()

    expect(messages[0]!.preview).toHaveLength(80)
    expect(messages[0]!.preview!.endsWith('…')).toBe(true)
  })

  it('ticket sem row ou já terminado fica de fora, e a posição segue a lista', async () => {
    const { run } = makeSut(
      zapi,
      ['sumiu', 'enviado', 'ok'],
      [row('enviado', { status: 'SENT' }), row('ok')],
    )

    const { messages } = await run()

    expect(messages.map(m => [m.position, m.preview])).toEqual([
      [1, 'texto ok'],
    ])
  })

  it('linha oficial não lista nada', async () => {
    const { run, cadence } = makeSut(
      {
        ...zapi,
        metadata: { provider: 'HUBMESSAGE', hubmessageChannelId: 'C' },
      },
      ['a'],
      [row('a')],
    )

    expect(await run()).toEqual({ total: 0, messages: [] })
    expect(cadence.queuedTickets).not.toHaveBeenCalled()
  })
})

describe('ListLineCadenceQueue — nome do operador', () => {
  const rowsOf = () => [
    row('op1', { origin: 'OPERATOR', operatorBitrixUserId: '27' }),
    row('op2', { origin: 'OPERATOR', operatorBitrixUserId: '27' }),
    row('w', { origin: 'WIDGET', operatorBitrixUserId: '27' }),
  ]

  it('resolve o nome uma vez por operador e só nas respostas do operador', async () => {
    const resolve = vi.fn(() =>
      Promise.resolve(new Map([['27', 'Maria Silva']])),
    )
    const { run } = makeSut(zapi, ['op1', 'op2', 'w'], rowsOf(), 3, resolve)

    const { messages } = await run()

    expect(resolve).toHaveBeenCalledWith(
      { domainName: 'acme', appCode: 'app' },
      ['27'],
    )
    expect(messages.map(m => m.operatorName)).toEqual([
      'Maria Silva',
      'Maria Silva',
      null,
    ])
  })

  it('falha na leitura dos nomes: a lista sai sem o nome', async () => {
    const resolve = vi.fn(() => Promise.reject(new Error('bitrix')))
    const { run } = makeSut(zapi, ['op1'], rowsOf(), 1, resolve)

    const { messages } = await run()

    expect(messages[0]!.operatorName).toBeNull()
  })

  it('sem resposta do operador na fila, não lê nome nenhum', async () => {
    const resolve = vi.fn(() => Promise.resolve(new Map<string, string>()))
    const { run } = makeSut(zapi, ['w'], rowsOf(), 1, resolve)

    await run()

    expect(resolve).not.toHaveBeenCalled()
  })
})
