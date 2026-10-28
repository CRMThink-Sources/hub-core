import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import type { Request, Response } from 'express'
import {
  ActivateSubscription,
  DeactivateSubscription,
} from '../../application/subscription-status-actions'
import { subscribeSubscriptionLines } from '../../application/subscribe-subscription-lines'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import {
  ActivateSubscriptionController,
  DeactivateSubscriptionController,
  SubscribeSubscriptionLinesController,
} from './subscription-actions-controllers'

const request = (body: unknown = {}) =>
  ({
    params: { appId: 'app-1', subscriptionId: 'sub-1' },
    body,
  }) as unknown as Request

const disabledDeps = () => {
  const deps = {
    apps: { findById: vi.fn() },
    subscriptions: { getSubscription: vi.fn(), updateSubscription: vi.fn() },
    sync: { execute: vi.fn() },
    providerEffectsEnabled: false,
  }
  return deps
}

describe('ações na assinatura com os efeitos de provider desligados', () => {
  it.each([
    [
      'activate',
      (deps: ReturnType<typeof disabledDeps>) =>
        new ActivateSubscriptionController(
          new ActivateSubscription(deps as never),
        ),
    ],
    [
      'deactivate',
      (deps: ReturnType<typeof disabledDeps>) =>
        new DeactivateSubscriptionController(
          new DeactivateSubscription(deps as never),
        ),
    ],
    [
      'subscribe-lines',
      (deps: ReturnType<typeof disabledDeps>) =>
        new SubscribeSubscriptionLinesController(input =>
          subscribeSubscriptionLines(input, deps as never),
        ),
    ],
  ])(
    '%s responde 409 provider-effects-disabled sem ler nem gravar',
    async (_name, make) => {
      const deps = disabledDeps()

      const response = await make(deps).perform(request(), {} as Response)

      expect(response.status).toBe(409)
      expect(response.result).toMatchObject({
        reason: 'provider-effects-disabled',
      })
      expect(deps.apps.findById).not.toHaveBeenCalled()
      expect(deps.subscriptions.getSubscription).not.toHaveBeenCalled()
      expect(deps.subscriptions.updateSubscription).not.toHaveBeenCalled()
      expect(deps.sync.execute).not.toHaveBeenCalled()
    },
  )
})

describe('ActivateSubscriptionController', () => {
  it('repassa o novo fim de período do corpo', async () => {
    const execute = vi.fn().mockResolvedValue({ id: 'sub-1', status: 'active' })

    const response = await new ActivateSubscriptionController({
      execute,
    }).perform(request({ currentPeriodEnd: '2026-12-01' }), {} as Response)

    expect(execute).toHaveBeenCalledWith({
      appId: 'app-1',
      subscriptionId: 'sub-1',
      currentPeriodEnd: '2026-12-01',
    })
    expect(response.status).toBe(200)
  })

  it('falha do CRM vira 502', async () => {
    const response = await new ActivateSubscriptionController({
      execute: vi.fn().mockRejectedValue(new BitrixError('fora')),
    }).perform(request(), {} as Response)

    expect(response.status).toBe(502)
  })
})

describe('SubscribeSubscriptionLinesController', () => {
  it('falha parcial responde 200 com as contagens', async () => {
    const counts = {
      items: 3,
      subscribed: 1,
      unsubscribed: 0,
      failed: 1,
      ignored: 1,
    }

    const response = await new SubscribeSubscriptionLinesController(() =>
      Promise.resolve(counts),
    ).perform(request(), {} as Response)

    expect(response).toEqual({ status: 200, result: counts })
  })
})
