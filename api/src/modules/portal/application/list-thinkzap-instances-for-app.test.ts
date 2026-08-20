import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const findFirst = vi.fn()
const getInstance = vi.fn()
const execute = vi.fn()
const getById = vi.fn()

vi.mock('@/config/prisma', () => ({
  prisma: { instance: { findFirst }, connector: { findUnique: findFirst } },
}))

vi.mock('@/modules/application/main/make-get-aplication-context', () => ({
  makeGetAplicationContext: () => ({ execute }),
}))

vi.mock(
  '@/shared/infra/persistence/repositories/prisma-installed-app.repository',
  () => ({
    PrismaInstalledAppRepository: class {
      getById = getById
    },
  }),
)

vi.mock('@/modules/thinkzap/infra/clients/z-api.client', () => ({
  ZApiClient: class {
    getInstance = getInstance
  },
}))

import { listThinkzapInstancesForApp } from './list-thinkzap-instances-for-app'

const NOW = new Date('2026-08-19T12:00:00.000Z')

const item = (
  id: string,
  metadata: SubscriptionItem['metadata'],
  status: SubscriptionItem['status'] = 'active',
): SubscriptionItem => ({
  id,
  name: `Linha ${id}`,
  subscription: 'sub-1',
  status,
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: 'chat-1',
  metadata,
})

const ZAPI = item('item-1', {
  provider: 'ZAPI',
  zApiInstanceId: 'Z-1',
  zApiInstanceToken: 'TOKEN',
})

const HUB = item('item-2', {
  provider: 'HUBMESSAGE',
  hubmessageChannelId: 'C-9',
  wabaId: 'W-9',
})

const ACTIVE_SUBSCRIPTION = {
  status: 'active',
  currentPeriodEnd: new Date('2026-12-01T00:00:00.000Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  getById.mockResolvedValue({
    id: 'app-1',
    domainId: 'domain-1',
    appCodeId: 'crmthink.thinkzap',
  })
  getInstance.mockResolvedValue({
    name: 'Comercial',
    connected: true,
    paymentStatus: 'active',
  })
})

describe('listThinkzapInstancesForApp', () => {
  it('lista linha nascida na SPA sem consultar as tabelas legadas', async () => {
    execute.mockResolvedValue({
      subscriptions: [{ ...ACTIVE_SUBSCRIPTION, items: [ZAPI, HUB] }],
    })

    const { instances } = await listThinkzapInstancesForApp('app-1', NOW)

    expect(findFirst).not.toHaveBeenCalled()
    expect(instances).toHaveLength(2)
    expect(instances[0]).toMatchObject({
      subscriptionItemId: 'item-1',
      provider: 'ZAPI',
      instanceId: 'Z-1',
      itemStatus: 'active',
      entitlement: 'active',
      zapiConnected: true,
    })
    expect(instances[1]).toMatchObject({
      subscriptionItemId: 'item-2',
      provider: 'HUBMESSAGE',
      instanceId: 'C-9',
      zapiConnected: null,
    })
  })

  it('não devolve os ids das rows legadas', async () => {
    execute.mockResolvedValue({
      subscriptions: [{ ...ACTIVE_SUBSCRIPTION, items: [ZAPI] }],
    })

    const { instances } = await listThinkzapInstancesForApp('app-1', NOW)

    expect(instances[0]).not.toHaveProperty('instanceDbId')
    expect(instances[0]).not.toHaveProperty('connectorId')
    expect(instances[0]).not.toHaveProperty('connectorStatus')
  })

  it('não serializa a credencial do item', async () => {
    execute.mockResolvedValue({
      subscriptions: [{ ...ACTIVE_SUBSCRIPTION, items: [ZAPI] }],
    })

    const output = await listThinkzapInstancesForApp('app-1', NOW)

    expect(JSON.stringify(output)).not.toContain('TOKEN')
  })

  it('expõe o item cancelado com itemStatus cancelled', async () => {
    execute.mockResolvedValue({
      subscriptions: [
        {
          ...ACTIVE_SUBSCRIPTION,
          items: [item('item-3', ZAPI.metadata, 'cancelled')],
        },
      ],
    })

    const { instances } = await listThinkzapInstancesForApp('app-1', NOW)

    expect(instances[0]?.itemStatus).toBe('cancelled')
  })

  it('devolve trial expirado da instalação', async () => {
    execute.mockResolvedValue({
      subscriptions: [
        {
          status: 'trialing',
          currentPeriodEnd: new Date('2026-01-01T00:00:00.000Z'),
          items: [ZAPI],
        },
      ],
    })

    const { trial, instances } = await listThinkzapInstancesForApp('app-1', NOW)

    expect(trial).toMatchObject({ status: 'expired', provider: 'ZAPI' })
    expect(instances[0]?.entitlement).toBe('trial-expired')
  })

  it('devolve vazio para instalação inexistente', async () => {
    getById.mockResolvedValue(null)

    const output = await listThinkzapInstancesForApp('app-1', NOW)

    expect(output).toEqual({ instances: [], trial: { status: 'never' } })
    expect(execute).not.toHaveBeenCalled()
  })
})
