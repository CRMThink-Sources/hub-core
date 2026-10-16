import { describe, expect, it, vi } from 'vitest'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import type { DailySendQuota } from '@/modules/thinkzap/domain/ports/daily-send-quota.port'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import {
  dailyLimitPolicyOf,
  isDailyLimitReachedError,
  sendWithinDailyQuota,
} from './send-within-daily-quota'

const POLICY = { lineKey: 'Z-1', enabled: true, limit: 300 }

function quotaWith(status: 'reserved' | 'refused') {
  const release = vi.fn(() => Promise.resolve())
  const reserve = vi.fn(() =>
    Promise.resolve(
      status === 'reserved'
        ? { status: 'reserved' as const, reservation: { release } }
        : {
            status: 'refused' as const,
            counts: { sent: 300, extra: 0 },
            effectiveLimit: 300,
          },
    ),
  )
  const quota = {
    reserve,
    wouldRefuse: vi.fn(),
    addExtra: vi.fn(),
    usage: vi.fn(),
  } as unknown as DailySendQuota
  return { quota, reserve, release }
}

describe('sendWithinDailyQuota', () => {
  it('sucesso mantém a reserva', async () => {
    const { quota, release } = quotaWith('reserved')

    await expect(
      sendWithinDailyQuota(quota, POLICY, () => Promise.resolve('msg-1')),
    ).resolves.toBe('msg-1')
    expect(release).not.toHaveBeenCalled()
  })

  it('falha respondida pelo provider devolve a vaga e relança', async () => {
    const { quota, release } = quotaWith('reserved')
    const err = new HubMessageApiError(400, 'POST', '/v1/messages', {}, null)

    await expect(
      sendWithinDailyQuota(quota, POLICY, () => Promise.reject(err)),
    ).rejects.toBe(err)
    expect(release).toHaveBeenCalledOnce()
  })

  it('falha sem resposta (indeterminada) mantém a vaga', async () => {
    const { quota, release } = quotaWith('reserved')
    const err = new HubMessageApiError(
      undefined,
      'POST',
      '/v1/messages',
      null,
      new Error('timeout'),
    )

    await expect(
      sendWithinDailyQuota(quota, POLICY, () => Promise.reject(err)),
    ).rejects.toBe(err)
    expect(release).not.toHaveBeenCalled()
  })

  it('recusa por limite lança o código próprio sem chamar o provider', async () => {
    const { quota } = quotaWith('refused')
    const send = vi.fn(() => Promise.resolve('msg-1'))

    const error = await sendWithinDailyQuota(quota, POLICY, send).catch(
      (e: unknown) => e,
    )

    expect(isDailyLimitReachedError(error)).toBe(true)
    expect(send).not.toHaveBeenCalled()
  })

  it('policy nula só envia, sem tocar na cota', async () => {
    const { quota, reserve } = quotaWith('reserved')

    await expect(
      sendWithinDailyQuota(quota, null, () => Promise.resolve('msg-1')),
    ).resolves.toBe('msg-1')
    expect(reserve).not.toHaveBeenCalled()
  })
})

describe('dailyLimitPolicyOf', () => {
  it('linha oficial não tem cota', () => {
    expect(
      dailyLimitPolicyOf({
        provider: ConnectorProvider.HUBMESSAGE,
        lineKey: 'canal-1',
        settings: { dailyLimitEnabled: true, dailyLimit: 10 },
      }),
    ).toBeNull()
  })

  it('linha Z-API com limite ligado', () => {
    expect(
      dailyLimitPolicyOf({
        provider: ConnectorProvider.ZAPI,
        lineKey: 'Z-1',
        settings: { dailyLimitEnabled: true, dailyLimit: 300 },
      }),
    ).toEqual({ lineKey: 'Z-1', enabled: true, limit: 300 })
  })

  it('linha Z-API sem settings continua contada, com o limite desligado', () => {
    expect(
      dailyLimitPolicyOf({
        provider: ConnectorProvider.ZAPI,
        lineKey: 'Z-1',
      }),
    ).toEqual({ lineKey: 'Z-1', enabled: false, limit: 0 })
  })

  it('ligado sem valor válido conta como desligado', () => {
    expect(
      dailyLimitPolicyOf({
        provider: ConnectorProvider.ZAPI,
        lineKey: 'Z-1',
        settings: { dailyLimitEnabled: true, dailyLimit: null },
      })?.enabled,
    ).toBe(false)
  })

  it('sem instância não há chave para contar', () => {
    expect(
      dailyLimitPolicyOf({
        provider: ConnectorProvider.ZAPI,
        lineKey: null,
      }),
    ).toBeNull()
  })
})
