import { describe, expect, it, vi } from 'vitest'
import type {
  GetInboundFailure,
  InboundReprocessStatus,
  ListInboundFailures,
  ReprocessInboundFailures,
} from '../../application/inbound-failures'
import {
  GetInboundFailureController,
  ListInboundFailuresController,
  ReprocessInboundFailureController,
  ReprocessInboundFailuresBatchController,
} from './inbound-failures-controller'

const DAY_MS = 24 * 60 * 60 * 1000

function listSut(retentionDays = 7) {
  const execute = vi.fn().mockResolvedValue({ items: [], total: 0 })
  const controller = new ListInboundFailuresController(
    { execute } as unknown as ListInboundFailures,
    retentionDays,
  )
  return {
    execute,
    call: (query: Record<string, string>) =>
      controller.perform({ query } as never, {} as never),
  }
}

describe('ListInboundFailuresController', () => {
  it('listagem padrão: as duas situações, últimos 7 dias, página 1', async () => {
    const { execute, call } = listSut()

    const response = await call({})

    expect(response.status).toBe(200)
    const [filters] = execute.mock.calls[0]! as [
      { statuses: string[]; from: Date; to: Date; page: number; limit: number },
    ]
    expect(filters.statuses).toEqual(['FAILED', 'REPROCESSED'])
    expect(filters.to.getTime() - filters.from.getTime()).toBe(7 * DAY_MS)
    expect(filters).toMatchObject({ page: 1, limit: 20 })
  })

  it('devolve o prazo de guarda para a tela informar e limitar o seletor de datas', async () => {
    const { call } = listSut(5)

    const response = await call({})

    expect(response.result).toMatchObject({
      items: [],
      total: 0,
      retentionDays: 5,
    })
  })

  it('o período padrão segue o prazo de guarda', async () => {
    const { execute, call } = listSut(3)

    await call({})

    const [filters] = execute.mock.calls[0]! as [{ from: Date; to: Date }]
    expect(filters.to.getTime() - filters.from.getTime()).toBe(3 * DAY_MS)
  })

  it('filtra por portal exato, origem, situação e período', async () => {
    const { execute, call } = listSut()

    await call({
      domainId: 'domain-1',
      source: 'hubmessage',
      status: 'FAILED',
      from: '2026-11-10T00:00:00.000Z',
      to: '2026-11-12T00:00:00.000Z',
    })

    expect(execute.mock.calls[0]![0]).toMatchObject({
      domainId: 'domain-1',
      source: 'hubmessage',
      statuses: ['FAILED'],
      from: new Date('2026-11-10T00:00:00.000Z'),
      to: new Date('2026-11-12T00:00:00.000Z'),
    })
  })

  it('período maior que o prazo de guarda: 400 dizendo o máximo, sem consultar', async () => {
    const { execute, call } = listSut(7)

    const response = await call({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-31T00:00:00.000Z',
    })

    expect(response.status).toBe(400)
    expect((response.result as { error: string }).error).toContain('7 dias')
    expect(execute).not.toHaveBeenCalled()
  })

  it('origem ou situação fora da lista: 400', async () => {
    const { call } = listSut()

    expect((await call({ source: 'email' })).status).toBe(400)
    expect((await call({ status: 'SENT' })).status).toBe(400)
  })
})

describe('GetInboundFailureController', () => {
  it('404 quando não há falha com o id (ou já expirou)', async () => {
    const controller = new GetInboundFailureController({
      execute: vi.fn().mockResolvedValue(null),
    } as unknown as GetInboundFailure)

    const response = await controller.perform(
      { params: { id: 'x' } } as never,
      {} as never,
    )

    expect(response.status).toBe(404)
    expect((response.result as { error: string }).error).toContain(
      'prazo de guarda',
    )
  })

  it('200 com o detalhe', async () => {
    const controller = new GetInboundFailureController({
      execute: vi.fn().mockResolvedValue({ id: 'x' }),
    } as unknown as GetInboundFailure)

    const response = await controller.perform(
      { params: { id: 'x' } } as never,
      {} as never,
    )

    expect(response).toEqual({ status: 200, result: { id: 'x' } })
  })
})

function reprocessSut(status: InboundReprocessStatus) {
  const execute = vi.fn((input: { ids: string[] }) =>
    Promise.resolve(input.ids.map(id => ({ id, status }))),
  )
  return {
    execute,
    reprocess: { execute } as unknown as ReprocessInboundFailures,
  }
}

describe('ReprocessInboundFailureController', () => {
  const call = (status: InboundReprocessStatus, portalUserId?: string) => {
    const { execute, reprocess } = reprocessSut(status)
    const controller = new ReprocessInboundFailureController(reprocess)
    return {
      execute,
      run: () =>
        controller.perform(
          { params: { id: 'f-1' }, portalUserId } as never,
          {} as never,
        ),
    }
  }

  it('sem sessão: 401 e nada é reprocessado', async () => {
    const { execute, run } = call('requeued', undefined)

    expect((await run()).status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
  })

  it('reprocessada: 202', async () => {
    const { run } = call('requeued', 'user-1')

    expect(await run()).toEqual({
      status: 202,
      result: { id: 'f-1', status: 'requeued' },
    })
  })

  it.each([
    ['conflict', 409],
    ['not-reprocessable', 422],
    ['not-found', 404],
    ['schedule-failed', 503],
  ] as const)(
    '%s vira %i com o code para a tela escolher o aviso',
    async (status, http) => {
      const { run } = call(status, 'user-1')

      const response = await run()

      expect(response.status).toBe(http)
      expect(response.result).toMatchObject({ code: status })
    },
  )
})

describe('ReprocessInboundFailuresBatchController', () => {
  const run = (body: unknown, portalUserId: string | null = 'user-1') => {
    const { execute, reprocess } = reprocessSut('requeued')
    const controller = new ReprocessInboundFailuresBatchController(reprocess)
    return {
      execute,
      response: controller.perform(
        { body, portalUserId: portalUserId ?? undefined } as never,
        {} as never,
      ),
    }
  }

  it('lote: devolve o resultado de cada id', async () => {
    const { response, execute } = run({ ids: ['a', 'b'] })

    expect(await response).toEqual({
      status: 200,
      result: {
        results: [
          { id: 'a', status: 'requeued' },
          { id: 'b', status: 'requeued' },
        ],
      },
    })
    expect(execute).toHaveBeenCalledWith({
      ids: ['a', 'b'],
      portalUserId: 'user-1',
    })
  })

  it('sem ids, ou acima de 50: 400', async () => {
    expect((await run({ ids: [] }).response).status).toBe(400)
    expect(
      (
        await run({ ids: Array.from({ length: 51 }, (_, i) => `id-${i}`) })
          .response
      ).status,
    ).toBe(400)
  })

  it('sem sessão: 401', async () => {
    expect((await run({ ids: ['a'] }, null).response).status).toBe(401)
  })
})
