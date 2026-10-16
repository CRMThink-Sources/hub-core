import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: {
    logLevel: 'silent',
    nodeEnv: 'test',
    lokiUrl: '',
    bitrix: { connector: { code: 'thinkzap' } },
  },
}))

import { Request } from 'express'
import { ReleaseDailyLimitExtraController } from './release-daily-limit-extra.controller'

const req = (body: unknown) =>
  ({
    params: { itemId: 'i1' },
    body,
    domainId: 'domain-1',
    appId: 'crmthink.thinkzap',
  }) as unknown as Request

const USAGE = {
  enabled: true,
  limit: 300,
  sentToday: 300,
  extraToday: 100,
  effectiveLimit: 400,
  remainingPercent: 25,
  reached: false,
}

describe('ReleaseDailyLimitExtraController', () => {
  let execute: ReturnType<typeof vi.fn>
  let controller: ReleaseDailyLimitExtraController

  beforeEach(() => {
    execute = vi.fn().mockResolvedValue(USAGE)
    controller = new ReleaseDailyLimitExtraController({ execute } as never)
  })

  it('libera e devolve o uso atualizado', async () => {
    const response = await controller.perform(req({ amount: 100 }))

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ dailyLimit: USAGE })
    expect(execute).toHaveBeenCalledWith({
      subscriptionItemId: 'i1',
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
      amount: 100,
    })
  })

  it.each([
    { amount: 0 },
    { amount: -5 },
    { amount: 1.5 },
    {},
    { amount: 10, x: 1 },
  ])('devolve 400 para corpo %j', async body => {
    const response = await controller.perform(req(body))

    expect(response.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })
})
