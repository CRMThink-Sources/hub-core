import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import {
  FAILURE_TEXT_PREVIEW_LENGTH,
  GetOutboxFailure,
  ListOutboxFailures,
  ReprocessOutboxFailures,
} from './outbox-failures'

const record = (
  overrides: Partial<WidgetOutboxRecord> = {},
): WidgetOutboxRecord =>
  ({
    id: 'cd9192b3-dc67-4303-a048-b624ab4c59fb',
    domainId: 'domain-1',
    appCode: 'crmthink.thinkzap',
    subscriptionItemId: '77',
    origin: 'OPERATOR',
    kind: 'TEXT',
    status: 'FAILED',
    text: 'Buen día',
    fileName: null,
    destination: '275913178619939@lid',
    lastError: 'Linha não encontrada na instalação',
    attempts: 0,
    reprocessCount: 0,
    lastReprocessedAt: null,
    lastReprocessedBy: null,
    providerMessageId: null,
    bitrixChatId: '50656',
    bitrixMessageId: '3346860',
    operatorBitrixUserId: '39154',
    createdAt: new Date('2026-10-27T13:22:23.503Z'),
    updatedAt: new Date('2026-10-27T13:23:11.652Z'),
    ...overrides,
  }) as WidgetOutboxRecord

describe('ListOutboxFailures', () => {
  it('trunca o texto na lista e repassa a paginação', async () => {
    const long = 'x'.repeat(FAILURE_TEXT_PREVIEW_LENGTH + 50)
    const listFailures = vi.fn().mockResolvedValue({
      items: [{ ...record({ text: long }), domainName: 'querobombinhas' }],
      total: 1,
    })

    const result = await new ListOutboxFailures({ listFailures }).execute({
      statuses: ['FAILED', 'UNKNOWN'],
      from: new Date(),
      to: new Date(),
      page: 1,
      limit: 20,
    })

    expect(result.total).toBe(1)
    expect(result.items[0]!.text).toHaveLength(FAILURE_TEXT_PREVIEW_LENGTH + 1)
    expect(result.items[0]!.domainName).toBe('querobombinhas')
  })
})

describe('GetOutboxFailure', () => {
  it('Detalhe de falha do canal aberto: texto integral e contexto do chat', async () => {
    const findFailureDetail = vi.fn().mockResolvedValue({
      ...record(),
      domainName: 'querobombinhas.bitrix24.com.br',
      lastReprocessedByEmail: null,
    })

    const detail = await new GetOutboxFailure({ findFailureDetail }).execute(
      'cd9192b3-dc67-4303-a048-b624ab4c59fb',
    )

    expect(detail).toMatchObject({
      text: 'Buen día',
      destination: '275913178619939@lid',
      bitrixChatId: '50656',
      bitrixMessageId: '3346860',
      operatorBitrixUserId: '39154',
      lastError: 'Linha não encontrada na instalação',
    })
  })

  it('intenção entregue de primeira não aparece na tela de falhas', async () => {
    const findFailureDetail = vi.fn().mockResolvedValue({
      ...record({ status: 'SENT' }),
      domainName: null,
      lastReprocessedByEmail: null,
    })

    await expect(
      new GetOutboxFailure({ findFailureDetail }).execute('x'),
    ).resolves.toBeNull()
  })

  it('intenção reprocessada continua visível para acompanhar o desfecho', async () => {
    const findFailureDetail = vi.fn().mockResolvedValue({
      ...record({ status: 'SENT', reprocessCount: 1 }),
      domainName: null,
      lastReprocessedByEmail: 'suporte@crmthink.com',
    })

    await expect(
      new GetOutboxFailure({ findFailureDetail }).execute('x'),
    ).resolves.toMatchObject({
      status: 'SENT',
      lastReprocessedByEmail: 'suporte@crmthink.com',
    })
  })
})

describe('ReprocessOutboxFailures', () => {
  const rows = new Map<string, WidgetOutboxRecord>()
  const findById = vi.fn((id: string) => Promise.resolve(rows.get(id) ?? null))
  /** Simula o `updateMany` condicional: só o primeiro pedido acha a row em FAILED. */
  const requeueForReprocess = vi.fn(
    (id: string, input: { allowUnknown: boolean }) => {
      const row = rows.get(id)
      const accepted = input.allowUnknown ? ['FAILED', 'UNKNOWN'] : ['FAILED']
      if (!row || row.providerMessageId || !accepted.includes(row.status)) {
        return Promise.resolve(false)
      }
      rows.set(id, {
        ...row,
        status: 'PENDING',
        reprocessCount: row.reprocessCount + 1,
      })
      return Promise.resolve(true)
    },
  )
  const markFailed = vi.fn(() => Promise.resolve())
  const ensureScheduled = vi.fn(() => Promise.resolve(true))

  const sut = () =>
    new ReprocessOutboxFailures(
      { findById, requeueForReprocess, markFailed },
      { ensureScheduled },
    )

  beforeEach(() => {
    rows.clear()
    vi.clearAllMocks()
    ensureScheduled.mockImplementation(() => Promise.resolve(true))
  })

  it('Reprocessar o "Buen día" que falhou: volta para a fila e agenda o job', async () => {
    rows.set('a', record({ id: 'a' }))

    const results = await sut().execute({
      ids: ['a'],
      portalUserId: 'user-1',
      acknowledgeDuplicateRisk: false,
    })

    expect(results).toEqual([{ id: 'a', status: 'requeued' }])
    expect(rows.get('a')).toMatchObject({
      status: 'PENDING',
      reprocessCount: 1,
    })
    expect(ensureScheduled).toHaveBeenCalledWith('a')
  })

  it('Reprocessar duas vezes ao mesmo tempo: só um é aceito, o outro é conflito', async () => {
    rows.set('a', record({ id: 'a' }))

    const [first, second] = await Promise.all([
      sut().execute({
        ids: ['a'],
        portalUserId: 'user-1',
        acknowledgeDuplicateRisk: false,
      }),
      sut().execute({
        ids: ['a'],
        portalUserId: 'user-2',
        acknowledgeDuplicateRisk: false,
      }),
    ])

    const statuses = [first[0]!.status, second[0]!.status].sort()
    expect(statuses).toEqual(['conflict', 'requeued'])
    expect(ensureScheduled).toHaveBeenCalledTimes(1)
  })

  it('Mensagem já enviada: conflito e nada é agendado', async () => {
    rows.set('a', record({ id: 'a', status: 'SENT', providerMessageId: 'X' }))

    const results = await sut().execute({
      ids: ['a'],
      portalUserId: 'user-1',
      acknowledgeDuplicateRisk: false,
    })

    expect(results).toEqual([{ id: 'a', status: 'conflict' }])
    expect(ensureScheduled).not.toHaveBeenCalled()
  })

  it('UNKNOWN sem confirmação: recusado sem alterar a intenção', async () => {
    rows.set('a', record({ id: 'a', status: 'UNKNOWN' }))

    const results = await sut().execute({
      ids: ['a'],
      portalUserId: 'user-1',
      acknowledgeDuplicateRisk: false,
    })

    expect(results).toEqual([{ id: 'a', status: 'needs-confirmation' }])
    expect(requeueForReprocess).not.toHaveBeenCalled()
  })

  it('UNKNOWN com confirmação: volta para a fila', async () => {
    rows.set('a', record({ id: 'a', status: 'UNKNOWN' }))

    const results = await sut().execute({
      ids: ['a'],
      portalUserId: 'user-1',
      acknowledgeDuplicateRisk: true,
    })

    expect(results).toEqual([{ id: 'a', status: 'requeued' }])
  })

  it('Lote com uma mensagem já enviada: as demais seguem e a enviada volta com o motivo', async () => {
    rows.set('a', record({ id: 'a' }))
    rows.set('b', record({ id: 'b', status: 'SENT', providerMessageId: 'X' }))
    rows.set('c', record({ id: 'c' }))

    const results = await sut().execute({
      ids: ['a', 'b', 'c'],
      portalUserId: 'user-1',
      acknowledgeDuplicateRisk: false,
    })

    expect(results).toEqual([
      { id: 'a', status: 'requeued' },
      { id: 'b', status: 'conflict' },
      { id: 'c', status: 'requeued' },
    ])
  })

  it('id inexistente é not-found', async () => {
    const results = await sut().execute({
      ids: ['nada'],
      portalUserId: 'user-1',
      acknowledgeDuplicateRisk: false,
    })

    expect(results).toEqual([{ id: 'nada', status: 'not-found' }])
  })

  it('falha ao agendar devolve a intenção a FAILED para não ficar parada', async () => {
    rows.set('a', record({ id: 'a' }))
    ensureScheduled.mockImplementation(() =>
      Promise.reject(new Error('redis down')),
    )

    const results = await sut().execute({
      ids: ['a'],
      portalUserId: 'user-1',
      acknowledgeDuplicateRisk: false,
    })

    expect(results).toEqual([{ id: 'a', status: 'schedule-failed' }])
    expect(markFailed).toHaveBeenCalledWith('a', expect.any(String))
  })
})
