import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { subscribeSubscriptionLines } from './subscribe-subscription-lines'
import { SubscriptionLinesBillingError } from '@/modules/thinkzap/application/sync-subscription-lines-billing'
import { ProviderEffectsDisabledError } from '../domain/errors/portal-domain.errors'
import { SubscriptionNotInAppError } from '../domain/errors/subscription-action.errors'

const makeDeps = (
  sync: ReturnType<typeof vi.fn>,
  options: { modality?: string; providerEffectsEnabled?: boolean } = {},
) => ({
  apps: {
    findById: vi.fn().mockResolvedValue({ id: 'app-1', spaId: '1060-1' }),
  },
  subscriptions: {
    getSubscription: vi.fn().mockResolvedValue({
      id: 'sub-1',
      status: 'active',
      modality: options.modality ?? 'manual',
      aplication: { spaId: '1060-1' },
    }),
  } as never,
  sync: { execute: sync } as never,
  providerEffectsEnabled: options.providerEffectsEnabled ?? true,
})

const INPUT = { appId: 'app-1', subscriptionId: 'sub-1' }

describe('subscribeSubscriptionLines', () => {
  it('roda a reconciliação da assinatura e devolve as contagens com ignoradas', async () => {
    const sync = vi.fn().mockResolvedValue({
      items: 3,
      subscribed: 1,
      unsubscribed: 0,
      failed: 0,
    })

    const result = await subscribeSubscriptionLines(INPUT, makeDeps(sync))

    const [call] = sync.mock.calls[0] as [
      { subscriptionId: string; traceKey: string },
    ]
    expect(call.subscriptionId).toBe('sub-1')
    expect(call.traceKey).toMatch(/^backoffice-subscribe-lines-/)
    expect(result).toEqual({
      items: 3,
      subscribed: 1,
      unsubscribed: 0,
      failed: 0,
      ignored: 2,
    })
  })

  it('falha parcial vira resultado com as contagens, não erro', async () => {
    const sync = vi.fn().mockRejectedValue(
      new SubscriptionLinesBillingError('sub-1', ['item-3'], {
        items: 3,
        subscribed: 1,
        unsubscribed: 0,
        failed: 1,
      }),
    )

    const result = await subscribeSubscriptionLines(INPUT, makeDeps(sync))

    expect(result).toEqual({
      items: 3,
      subscribed: 1,
      unsubscribed: 0,
      failed: 1,
      ignored: 1,
    })
  })

  it('vale também para assinatura Stripe', async () => {
    const sync = vi.fn().mockResolvedValue({
      items: 1,
      subscribed: 0,
      unsubscribed: 0,
      failed: 0,
    })

    await subscribeSubscriptionLines(
      INPUT,
      makeDeps(sync, { modality: 'stripe' }),
    )

    expect(sync).toHaveBeenCalled()
  })

  it('outro erro propaga', async () => {
    const sync = vi.fn().mockRejectedValue(new Error('bitrix fora'))

    await expect(
      subscribeSubscriptionLines(INPUT, makeDeps(sync)),
    ).rejects.toThrow('bitrix fora')
  })

  it('assinatura de outra instalação: não reconcilia', async () => {
    const sync = vi.fn()
    const deps = makeDeps(sync)
    deps.apps.findById.mockResolvedValue({ id: 'app-1', spaId: '1060-9' })

    await expect(
      subscribeSubscriptionLines(INPUT, deps),
    ).rejects.toBeInstanceOf(SubscriptionNotInAppError)
    expect(sync).not.toHaveBeenCalled()
  })

  it('efeitos de provider desligados: não reconcilia', async () => {
    const sync = vi.fn()

    await expect(
      subscribeSubscriptionLines(
        INPUT,
        makeDeps(sync, { providerEffectsEnabled: false }),
      ),
    ).rejects.toBeInstanceOf(ProviderEffectsDisabledError)
    expect(sync).not.toHaveBeenCalled()
  })
})
