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
import { ResetDailyLimitUsageController } from './reset-daily-limit-usage.controller'

const req = {
  params: { itemId: 'i1' },
  domainId: 'domain-1',
  appId: 'crmthink.thinkzap',
  bitrixUserId: '7',
} as unknown as Request

describe('ResetDailyLimitUsageController', () => {
  it('zera e devolve o uso atualizado, com quem zerou do token', async () => {
    const dailyLimit = { sentToday: 0, extraToday: 0, effectiveLimit: 300 }
    const execute = vi.fn().mockResolvedValue(dailyLimit)
    const controller = new ResetDailyLimitUsageController({ execute } as never)

    const response = await controller.perform(req)

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ dailyLimit })
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionItemId: 'i1', bitrixUserId: '7' }),
    )
  })
})
