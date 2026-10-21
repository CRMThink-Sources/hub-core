import { describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: {
    logLevel: 'silent',
    nodeEnv: 'test',
    lokiUrl: '',
    bitrix: { connector: { code: 'thinkzap' } },
  },
}))

import type { Request } from 'express'
import { GetLineCadenceQueueController } from './get-line-cadence-queue.controller'

const req = (query: Record<string, unknown>) =>
  ({
    params: { itemId: 'i1' },
    query,
    domainId: 'domain-1',
    appId: 'crmthink.thinkzap',
  }) as unknown as Request

function makeSut() {
  const execute = vi
    .fn()
    .mockResolvedValue({ total: 0, offset: 0, limit: 10, messages: [] })
  return {
    execute,
    controller: new GetLineCadenceQueueController({ execute } as never),
  }
}

describe('GetLineCadenceQueueController', () => {
  it('repassa offset e limit da query como números', async () => {
    const { controller, execute } = makeSut()

    const response = await controller.perform(
      req({ offset: '10', limit: '10' }),
    )

    expect(response.status).toBe(200)
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionItemId: 'i1',
        offset: 10,
        limit: 10,
      }),
    )
  })

  it('sem parâmetros deixa o padrão para o caso de uso', async () => {
    const { controller, execute } = makeSut()

    await controller.perform(req({}))

    expect(execute).toHaveBeenCalledWith(
      expect.not.objectContaining({ offset: expect.anything() as unknown }),
    )
  })

  it.each([{ offset: '-1' }, { limit: '0' }, { limit: '51' }, { offset: 'x' }])(
    'parâmetro inválido %j dá 400',
    async query => {
      const { controller, execute } = makeSut()

      expect((await controller.perform(req(query))).status).toBe(400)
      expect(execute).not.toHaveBeenCalled()
    },
  )
})
