import { describe, expect, it, vi } from 'vitest'
import type { Subscription } from '@/modules/application/domain/entities/subscription'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import type { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { ApplyGatewaySubscriptionState } from './apply-gateway-subscription-state'
import type {
  ItemBillingResult,
  ProviderResourceBilling,
} from './provider-resource-billing'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const OCT_28 = new Date('2026-10-28T23:59:59.999Z')
const NOV_28 = new Date('2026-11-28T23:59:59.999Z')
const START = new Date('2026-10-28T00:00:00.000Z')

const subscription = (overrides: Partial<Subscription> = {}) =>
  ({
    id: '99',
    status: 'active',
    currentPeriodEnd: OCT_28,
    modality: 'stripe',
    gatewayId: 'sub_1',
    ...overrides,
  }) as Subscription

const item = (id: string): SubscriptionItem => ({
  id,
  name: 'WhatsApp',
  subscription: '99',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: `inst-${id}`,
    zApiInstanceToken: 'tok',
  },
})

const make = (
  options: {
    contract?: Subscription[]
    items?: SubscriptionItem[]
    failWrite?: boolean
    unsubscribe?: (item: SubscriptionItem) => ItemBillingResult
  } = {},
) => {
  const updateSubscription = vi.fn(() =>
    options.failWrite
      ? Promise.reject(new Error('bitrix fora'))
      : Promise.resolve({}),
  )
  const subscriptions = {
    listSubscriptionsByGatewayId: vi.fn(() =>
      Promise.resolve(options.contract ?? [subscription()]),
    ),
    updateSubscription,
  } as unknown as SubscriptionRepository
  const items = {
    getSubscriptionItemsBySubscription: vi.fn(() =>
      Promise.resolve(options.items ?? [item('77')]),
    ),
  } as unknown as SubscriptionItemRepository
  const unsubscribe = vi.fn((line: SubscriptionItem) =>
    Promise.resolve(
      options.unsubscribe?.(line) ?? {
        status: 'unsubscribed' as const,
        provider: 'ZAPI' as const,
      },
    ),
  )
  const billing = { unsubscribe } as unknown as ProviderResourceBilling

  return {
    apply: new ApplyGatewaySubscriptionState(subscriptions, items, billing),
    updateSubscription,
    unsubscribe,
  }
}

describe('ApplyGatewaySubscriptionState.applyUpdate', () => {
  it('assinatura que já concorda fica unchanged e não é escrita', async () => {
    const { apply, updateSubscription } = make()

    const result = await apply.applyUpdate(
      'sub_1',
      { status: 'active', currentPeriodStart: START, currentPeriodEnd: OCT_28 },
      1,
    )

    expect(updateSubscription).not.toHaveBeenCalled()
    expect(result).toEqual({
      known: true,
      subscriptions: [
        {
          subscriptionId: '99',
          outcome: 'unchanged',
          from: { status: 'active', currentPeriodEnd: OCT_28 },
        },
      ],
    })
  })

  it('mesmo dia de fim com hora diferente não é divergência', async () => {
    const { apply, updateSubscription } = make()

    const result = await apply.applyUpdate(
      'sub_1',
      {
        status: 'active',
        currentPeriodStart: START,
        currentPeriodEnd: new Date('2026-10-28T14:03:00.000Z'),
      },
      1,
    )

    expect(updateSubscription).not.toHaveBeenCalled()
    expect(result.subscriptions[0]?.outcome).toBe('unchanged')
  })

  it('atualiza status e período e devolve antes e depois', async () => {
    const { apply, updateSubscription } = make()
    const patch = {
      status: 'past_due' as const,
      currentPeriodStart: START,
      currentPeriodEnd: NOV_28,
    }

    const result = await apply.applyUpdate('sub_1', patch, 1)

    expect(updateSubscription).toHaveBeenCalledWith('99', patch)
    expect(result.subscriptions[0]).toEqual({
      subscriptionId: '99',
      outcome: 'updated',
      from: { status: 'active', currentPeriodEnd: OCT_28 },
      to: { status: 'past_due', currentPeriodEnd: NOV_28 },
    })
  })

  it('falha ao escrever vira failed com a mensagem', async () => {
    const { apply } = make({ failWrite: true })

    const result = await apply.applyUpdate(
      'sub_1',
      { status: 'active', currentPeriodStart: START, currentPeriodEnd: NOV_28 },
      1,
    )

    expect(result.subscriptions[0]).toMatchObject({
      outcome: 'failed',
      error: 'bitrix fora',
    })
  })

  it('id do gateway sem assinatura na SPA devolve known false', async () => {
    const { apply } = make({ contract: [] })

    await expect(
      apply.applyUpdate(
        'sub_x',
        {
          status: 'active',
          currentPeriodStart: START,
          currentPeriodEnd: OCT_28,
        },
        0,
      ),
    ).resolves.toEqual({ known: false, subscriptions: [] })
  })
})

describe('ApplyGatewaySubscriptionState.applyCancellation', () => {
  it('cancela e desassina as duas linhas, registrando cada uma', async () => {
    const { apply, updateSubscription, unsubscribe } = make({
      items: [item('77'), item('78')],
      unsubscribe: line =>
        line.id === '78'
          ? { status: 'failed', provider: 'ZAPI' }
          : { status: 'unsubscribed', provider: 'ZAPI' },
    })

    const result = await apply.applyCancellation('sub_1')

    expect(updateSubscription).toHaveBeenCalledWith('99', {
      status: 'cancelled',
    })
    expect(unsubscribe).toHaveBeenCalledTimes(2)
    expect(result.subscriptions[0]).toEqual({
      subscriptionId: '99',
      outcome: 'cancelled',
      from: { status: 'active', currentPeriodEnd: OCT_28 },
      to: { status: 'cancelled', currentPeriodEnd: null },
      lines: [
        { itemId: '77', provider: 'ZAPI', succeeded: true },
        { itemId: '78', provider: 'ZAPI', succeeded: false },
      ],
    })
  })

  it('linha sem credencial não aparece entre as linhas', async () => {
    const { apply } = make({
      unsubscribe: () => ({ status: 'skipped', provider: null }),
    })

    const result = await apply.applyCancellation('sub_1')

    expect(result.subscriptions[0]?.lines).toEqual([])
  })

  it('falha ao gravar o cancelamento não desassina', async () => {
    const { apply, unsubscribe } = make({ failWrite: true })

    const result = await apply.applyCancellation('sub_1')

    expect(unsubscribe).not.toHaveBeenCalled()
    expect(result.subscriptions[0]).toMatchObject({
      outcome: 'failed',
      error: 'bitrix fora',
    })
  })

  it('já cancelada fica unchanged', async () => {
    const { apply, updateSubscription } = make({
      contract: [subscription({ status: 'cancelled' })],
    })

    const result = await apply.applyCancellation('sub_1')

    expect(updateSubscription).not.toHaveBeenCalled()
    expect(result.subscriptions[0]?.outcome).toBe('unchanged')
  })
})
