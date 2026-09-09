import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: {
    logLevel: 'silent',
    nodeEnv: 'test',
    lokiUrl: '',
    bitrix: { connector: { code: 'thinkzap' } },
  },
}))

import type { Request } from 'express'
import { GetThinkzapHomeMessageStatsController } from './get-thinkzap-home-message-stats.controller'
import * as useCase from '@/modules/thinkzap/application/get-thinkzap-home-message-stats'

const getStatsSpy = vi.spyOn(useCase, 'getThinkzapHomeMessageStats')

function makeReq(query: Record<string, string>): Request {
  return {
    domainId: 'domain-1',
    appId: 'crmthink.thinkzap',
    query,
  } as unknown as Request
}

describe('GetThinkzapHomeMessageStatsController', () => {
  const controller = new GetThinkzapHomeMessageStatsController(
    {} as never,
    {} as never,
    {} as never,
  )

  beforeEach(() => {
    getStatsSpy.mockReset()
    getStatsSpy.mockResolvedValue({ zapi: { sent: 1, received: 2 } })
  })

  it('responde 200 com a contagem quando o range é válido', async () => {
    const response = await controller.perform(
      makeReq({ from: '2026-01-01', to: '2026-02-01' }),
    )

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ zapi: { sent: 1, received: 2 } })
  })

  it('escopa a leitura pelo par (domainId, appCode) do token', async () => {
    await controller.perform(makeReq({ from: '2026-01-01', to: '2026-02-01' }))

    expect(getStatsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        domainId: 'domain-1',
        appCode: 'crmthink.thinkzap',
      }),
    )
  })

  it('recusa range acima de 6 meses antes de chamar o use case', async () => {
    await expect(
      controller.perform(makeReq({ from: '2026-01-01', to: '2026-08-01' })),
    ).rejects.toThrow()

    expect(getStatsSpy).not.toHaveBeenCalled()
  })

  it('aceita range de exatamente 6 meses', async () => {
    const response = await controller.perform(
      makeReq({ from: '2026-01-01', to: '2026-07-01' }),
    )

    expect(response.status).toBe(200)
  })

  it('recusa from posterior a to', async () => {
    await expect(
      controller.perform(makeReq({ from: '2026-02-01', to: '2026-01-01' })),
    ).rejects.toThrow()

    expect(getStatsSpy).not.toHaveBeenCalled()
  })

  it('recusa data em formato inválido', async () => {
    await expect(
      controller.perform(makeReq({ from: 'not-a-date', to: '2026-01-01' })),
    ).rejects.toThrow()
  })
})
