import { describe, expect, it, vi } from 'vitest'
import { BitrixMethodPausedError } from '@/shared/infra/bitrix-limits/bitrix-limits.port'
import type { GatewaySubscriptionState } from '@/modules/thinkzap/domain/ports/gateway-subscription-state-reader.port'
import type { StripeSubscriptionRef } from '@/modules/thinkzap/domain/ports/stripe-subscription-lister.port'
import type { GatewayStateResult } from './apply-gateway-subscription-state'
import { SyncStripeSubscriptions } from './sync-stripe-subscriptions'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const OCT_28 = new Date('2026-10-28T23:59:59.999Z')
const NOV_28 = new Date('2026-11-28T14:00:00Z')
const START = new Date('2026-10-28T14:00:00Z')

const ref = (
  id: string,
  gatewayId: string | null,
  environment: string | null = null,
): StripeSubscriptionRef => ({ id, gatewayId, environment })

const found = (
  overrides: Partial<Extract<GatewaySubscriptionState, { kind: 'found' }>> = {},
): GatewaySubscriptionState => ({
  kind: 'found',
  status: 'active',
  rawStatus: 'active',
  currentPeriodStart: START,
  currentPeriodEnd: NOV_28,
  totalLineQuantity: 1,
  ...overrides,
})

const make = (options: {
  refs: StripeSubscriptionRef[]
  states?: Record<string, GatewaySubscriptionState | Error>
  update?: GatewayStateResult
  cancellation?: GatewayStateResult
}) => {
  const readSubscriptionState = vi.fn((gatewayId: string) => {
    const state = options.states?.[gatewayId] ?? found()
    return state instanceof Error
      ? Promise.reject(state)
      : Promise.resolve(state)
  })
  const applyUpdate = vi.fn(() =>
    Promise.resolve(options.update ?? { known: true, subscriptions: [] }),
  )
  const applyCancellation = vi.fn(() =>
    Promise.resolve(options.cancellation ?? { known: true, subscriptions: [] }),
  )
  return {
    sync: new SyncStripeSubscriptions(
      { listStripeSubscriptions: vi.fn(() => Promise.resolve(options.refs)) },
      { readSubscriptionState },
      { applyUpdate, applyCancellation },
      'production',
    ),
    readSubscriptionState,
    applyUpdate,
    applyCancellation,
  }
}

describe('SyncStripeSubscriptions — seleção', () => {
  it('pula homolog e sem id do gateway; vazio conta como produção', async () => {
    const { sync, readSubscriptionState } = make({
      refs: [
        ref('1', 'sub_1'),
        ref('2', 'sub_2', 'homolog'),
        ref('3', null),
        ref('4', 'sub_4', 'production'),
      ],
    })

    const summary = await sync.execute()

    expect(readSubscriptionState.mock.calls.map(call => call[0])).toEqual([
      'sub_1',
      'sub_4',
    ])
    expect(summary).toMatchObject({ checked: 2, skipped: 2 })
  })

  it('duas assinaturas do mesmo contrato: o Stripe é lido uma vez', async () => {
    const { sync, readSubscriptionState, applyUpdate } = make({
      refs: [ref('1', 'sub_1'), ref('2', 'sub_1')],
    })

    await sync.execute()

    expect(readSubscriptionState).toHaveBeenCalledTimes(1)
    expect(applyUpdate).toHaveBeenCalledTimes(1)
  })
})

describe('SyncStripeSubscriptions — aplicação', () => {
  it('aplica status e período pelo caminho do webhook e registra a atualização', async () => {
    const { sync, applyUpdate } = make({
      refs: [ref('1', 'sub_1')],
      states: { sub_1: found({ status: 'past_due', totalLineQuantity: 2 }) },
      update: {
        known: true,
        subscriptions: [
          {
            subscriptionId: '1',
            outcome: 'updated',
            from: { status: 'active', currentPeriodEnd: OCT_28 },
            to: { status: 'past_due', currentPeriodEnd: NOV_28 },
          },
        ],
      },
    })

    const summary = await sync.execute()

    expect(applyUpdate).toHaveBeenCalledWith(
      'sub_1',
      {
        status: 'past_due',
        currentPeriodStart: START,
        currentPeriodEnd: NOV_28,
      },
      2,
      'stripe-sync',
    )
    expect(summary.updated).toBe(1)
    expect(summary.changes).toEqual([
      {
        kind: 'updated',
        subscriptionId: '1',
        gatewayId: 'sub_1',
        fromStatus: 'active',
        toStatus: 'past_due',
        fromPeriodEnd: OCT_28,
        toPeriodEnd: NOV_28,
        succeeded: true,
      },
    ])
  })

  it('já sincronizada não gera registro', async () => {
    const { sync } = make({
      refs: [ref('1', 'sub_1')],
      update: {
        known: true,
        subscriptions: [
          {
            subscriptionId: '1',
            outcome: 'unchanged',
            from: { status: 'active', currentPeriodEnd: OCT_28 },
          },
        ],
      },
    })

    const summary = await sync.execute()

    expect(summary.changes).toEqual([])
    expect(summary.updated).toBe(0)
  })

  it('Stripe cancelada: cancela e registra as linhas desassinadas', async () => {
    const { sync, applyCancellation, applyUpdate } = make({
      refs: [ref('1', 'sub_1')],
      states: { sub_1: found({ status: 'cancelled', rawStatus: 'canceled' }) },
      cancellation: {
        known: true,
        subscriptions: [
          {
            subscriptionId: '1',
            outcome: 'cancelled',
            from: { status: 'active', currentPeriodEnd: OCT_28 },
            to: { status: 'cancelled', currentPeriodEnd: null },
            lines: [
              { itemId: '9001', provider: 'ZAPI', succeeded: true },
              { itemId: '9002', provider: 'HUBMESSAGE', succeeded: false },
            ],
          },
        ],
      },
    })

    const summary = await sync.execute()

    expect(applyCancellation).toHaveBeenCalledWith('sub_1', 'stripe-sync')
    expect(applyUpdate).not.toHaveBeenCalled()
    expect(summary).toMatchObject({
      cancelled: 1,
      linesUnsubscribed: 1,
      failed: 1,
    })
    expect(summary.changes.map(change => change.kind)).toEqual([
      'cancelled',
      'line-unsubscribed',
      'line-unsubscribed',
    ])
  })

  it('não encontrada no Stripe só registra, sem tocar a SPA', async () => {
    const { sync, applyUpdate, applyCancellation } = make({
      refs: [ref('1', 'sub_x')],
      states: { sub_x: { kind: 'not-found' } },
    })

    const summary = await sync.execute()

    expect(applyUpdate).not.toHaveBeenCalled()
    expect(applyCancellation).not.toHaveBeenCalled()
    expect(summary.notFound).toBe(1)
    expect(summary.changes).toEqual([
      expect.objectContaining({
        kind: 'not-found',
        subscriptionId: '1',
        gatewayId: 'sub_x',
        succeeded: false,
      }),
    ])
  })

  it('status desconhecido só registra, com o status cru', async () => {
    const { sync, applyUpdate } = make({
      refs: [ref('1', 'sub_1')],
      states: { sub_1: found({ status: null, rawStatus: 'novo' }) },
    })

    const summary = await sync.execute()

    expect(applyUpdate).not.toHaveBeenCalled()
    expect(summary.changes[0]).toMatchObject({
      kind: 'unknown-status',
      toStatus: 'novo',
    })
  })

  it('falha no Stripe para uma não segura as seguintes', async () => {
    const { sync, applyUpdate } = make({
      refs: [ref('1', 'sub_1'), ref('2', 'sub_2')],
      states: { sub_1: new Error('ECONNRESET') },
    })

    const summary = await sync.execute()

    expect(applyUpdate).toHaveBeenCalledTimes(1)
    expect(summary.failed).toBe(1)
    expect(summary.changes[0]).toMatchObject({
      kind: 'failed',
      subscriptionId: '1',
      error: 'ECONNRESET',
    })
  })

  it('pausa do Bitrix encerra a rodada', async () => {
    const { sync } = make({
      refs: [ref('1', 'sub_1'), ref('2', 'sub_2')],
      states: {
        sub_1: new BitrixMethodPausedError(
          'crm.item.list',
          'portal.bitrix24.com.br',
          1000,
        ),
      },
    })

    const summary = await sync.execute()

    expect(summary.paused).toBe(true)
    expect(summary.checked).toBe(1)
  })
})
