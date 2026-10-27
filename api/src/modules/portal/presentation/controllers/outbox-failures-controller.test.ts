import { describe, expect, it, vi } from 'vitest'
import type {
  GetOutboxFailure,
  ListOutboxFailures,
  ReprocessOutboxFailures,
  ReprocessStatus,
} from '../../application/outbox-failures'
import {
  GetOutboxFailureController,
  ListOutboxFailuresController,
  ReprocessOutboxFailureController,
  ReprocessOutboxFailuresBatchController,
} from './outbox-failures-controller'

const DAY_MS = 24 * 60 * 60 * 1000

function listSut() {
  const execute = vi.fn().mockResolvedValue({ items: [], total: 0 })
  const controller = new ListOutboxFailuresController({
    execute,
  } as unknown as ListOutboxFailures)
  const call = (query: Record<string, string>) =>
    controller.perform({ query } as never, {} as never)
  return { execute, call }
}

describe('ListOutboxFailuresController', () => {
  it('Listagem padrão: os dois status, últimos 7 dias, página 1', async () => {
    const { execute, call } = listSut()

    const response = await call({})

    expect(response.status).toBe(200)
    const [filters] = execute.mock.calls[0]! as [
      { statuses: string[]; from: Date; to: Date; page: number; limit: number },
    ]
    expect(filters.statuses).toEqual(['FAILED', 'UNKNOWN'])
    expect(filters.to.getTime() - filters.from.getTime()).toBe(7 * DAY_MS)
    expect(filters).toMatchObject({ page: 1, limit: 20 })
  })

  it('Filtrar por portal e período', async () => {
    const { execute, call } = listSut()

    await call({
      domain: 'querobombinhas.bitrix24.com.br',
      from: '2026-10-27T00:00:00.000Z',
      to: '2026-10-27T23:59:59.999Z',
      status: 'FAILED',
      origin: 'OPERATOR',
    })

    expect(execute.mock.calls[0]![0]).toMatchObject({
      domain: 'querobombinhas.bitrix24.com.br',
      from: new Date('2026-10-27T00:00:00.000Z'),
      to: new Date('2026-10-27T23:59:59.999Z'),
      statuses: ['FAILED'],
      origin: 'OPERATOR',
    })
  })

  it('Período acima do máximo: 400 sem consultar', async () => {
    const { execute, call } = listSut()

    const response = await call({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-10-27T00:00:00.000Z',
    })

    expect(response.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })

  it('`from` depois de `to`: 400', async () => {
    const { call } = listSut()

    const response = await call({
      from: '2026-10-28T00:00:00.000Z',
      to: '2026-10-27T00:00:00.000Z',
    })

    expect(response.status).toBe(400)
  })

  it('status ou origem fora da lista: 400', async () => {
    const { call } = listSut()

    expect((await call({ status: 'SENT' })).status).toBe(400)
    expect((await call({ origin: 'EMAIL' })).status).toBe(400)
  })
})

describe('GetOutboxFailureController', () => {
  it('404 quando não há falha com o id', async () => {
    const controller = new GetOutboxFailureController({
      execute: vi.fn().mockResolvedValue(null),
    } as unknown as GetOutboxFailure)

    const response = await controller.perform(
      { params: { id: 'x' } } as never,
      {} as never,
    )

    expect(response.status).toBe(404)
  })
})

function reprocessSut(status: ReprocessStatus) {
  const execute = vi.fn((input: { ids: string[] }) =>
    Promise.resolve(input.ids.map(id => ({ id, status }))),
  )
  return {
    execute,
    reprocess: { execute } as unknown as ReprocessOutboxFailures,
  }
}

describe('ReprocessOutboxFailureController', () => {
  const call = (
    status: ReprocessStatus,
    req: { body?: unknown; portalUserId?: string } = {},
  ) => {
    const { execute, reprocess } = reprocessSut(status)
    const controller = new ReprocessOutboxFailureController(reprocess)
    const response = controller.perform(
      {
        params: { id: 'a' },
        body: req.body ?? {},
        portalUserId: 'portalUserId' in req ? req.portalUserId : 'user-1',
      } as never,
      {} as never,
    )
    return { execute, response }
  }

  it('aceito: 202', async () => {
    const { response, execute } = call('requeued')

    expect((await response).status).toBe(202)
    expect(execute).toHaveBeenCalledWith({
      ids: ['a'],
      portalUserId: 'user-1',
      acknowledgeDuplicateRisk: false,
    })
  })

  it('conflito: 409 com o código', async () => {
    const result = await call('conflict').response

    expect(result.status).toBe(409)
    expect(result.result).toMatchObject({ code: 'conflict' })
  })

  it('UNKNOWN sem confirmação: 422', async () => {
    expect((await call('needs-confirmation').response).status).toBe(422)
  })

  it('repassa a confirmação de risco de duplicidade', async () => {
    const { execute, response } = call('requeued', {
      body: { acknowledgeDuplicateRisk: true },
    })
    await response

    expect(execute.mock.calls[0]![0]).toMatchObject({
      acknowledgeDuplicateRisk: true,
    })
  })

  it('sem sessão: 401', async () => {
    const result = await call('requeued', { portalUserId: undefined }).response

    expect(result.status).toBe(401)
  })
})

describe('ReprocessOutboxFailuresBatchController', () => {
  const call = (body: unknown) => {
    const { execute, reprocess } = reprocessSut('requeued')
    const controller = new ReprocessOutboxFailuresBatchController(reprocess)
    return {
      execute,
      response: controller.perform(
        { body, portalUserId: 'user-1' } as never,
        {} as never,
      ),
    }
  }

  it('devolve o resultado por id', async () => {
    const { response } = call({ ids: ['a', 'b'] })
    const result = await response

    expect(result.status).toBe(200)
    expect(result.result).toEqual({
      results: [
        { id: 'a', status: 'requeued' },
        { id: 'b', status: 'requeued' },
      ],
    })
  })

  it('lote vazio ou acima de 50: 400', async () => {
    expect((await call({ ids: [] }).response).status).toBe(400)
    const tooMany = Array.from({ length: 51 }, (_, i) => `id-${i}`)
    expect((await call({ ids: tooMany }).response).status).toBe(400)
  })
})
