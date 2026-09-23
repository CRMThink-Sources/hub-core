import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { describe, expect, it } from 'vitest'
import { mapAplicationContextToView } from './aplication-context.mapper'
import {
  AplicationContext,
  SubscriptionWithItems,
} from '@/modules/application/application/get-aplication-context'
import { Aplication } from '@/modules/application/domain/entities/aplication'
import { Customer } from '@/modules/application/domain/entities/customer'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const customer: Customer = {
  id: 'domain-1',
  name: 'acme.bitrix24.com.br',
  memberId: 'member-1',
}

const aplication: Aplication = {
  id: 'app-1',
  spaId: '512',
  customer,
  appCode: 'crmthink.thinkzap',
  title: 'ThinkZap — Acme',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
}

const product = {
  id: '42',
  name: 'ThinkZap',
  billingModel: 'subscription',
  active: true,
}

/** Produto do plano diferente do produto da assinatura, de propósito. */
const planProduct = { ...product, id: '43', name: 'ThinkZap (legado)' }

const zApiItem: SubscriptionItem = {
  id: '77',
  name: 'Conector Z-API',
  subscription: '21',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'inst-1',
    zApiInstanceToken: 'TOKEN-SUPER-SECRETO',
  },
  gatewayId: 'si_abc',
}

const hubItem: SubscriptionItem = {
  id: '78',
  name: 'Conector HubMessage',
  subscription: '21',
  status: 'cancelled',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'HUBMESSAGE',
    hubmessageChannelId: 'chan-1',
    wabaId: 'waba-1',
  },
}

const noneItem: SubscriptionItem = {
  id: '79',
  name: 'Item de cobrança',
  subscription: '21',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: { provider: 'NONE' },
}

const subscription: SubscriptionWithItems = {
  id: '21',
  name: 'ThinkZap Pro — Acme',
  plan: {
    id: '7',
    name: 'ThinkZap Pro',
    product: planProduct,
    amount: 4990,
    interval: 'monthly',
    gatewayId: 'price_abc',
    active: true,
  },
  status: 'active',
  currentPeriodStart: new Date('2026-07-01T00:00:00.000Z'),
  currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
  aplication,
  gatewayId: 'sub_abc',
  modality: 'stripe',
  items: [zApiItem, hubItem, noneItem],
}

const context: AplicationContext = {
  customer,
  aplication,
  subscriptions: [subscription],
}

describe('mapAplicationContextToView', () => {
  it('serializa os quatro níveis da árvore', () => {
    const view = mapAplicationContextToView(context)

    expect(view.customer).toEqual({
      id: 'domain-1',
      name: 'acme.bitrix24.com.br',
      memberId: 'member-1',
    })
    expect(view.aplication).toEqual({
      id: 'app-1',
      spaId: '512',
      appCode: 'crmthink.thinkzap',
      title: 'ThinkZap — Acme',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    })
    expect(view.subscriptions).toHaveLength(1)
    expect(view.subscriptions[0]?.items.map(item => item.id)).toEqual([
      '77',
      '78',
      '79',
    ])
  })

  describe('vínculos para o pai são omitidos', () => {
    it('aplication não repete o cliente', () => {
      const view = mapAplicationContextToView(context)

      expect(view.aplication).not.toHaveProperty('customer')
    })

    it('subscription não repete a aplicação', () => {
      const view = mapAplicationContextToView(context)

      expect(view.subscriptions[0]).not.toHaveProperty('aplication')
    })

    it('item não repete a assinatura', () => {
      const view = mapAplicationContextToView(context)

      expect(view.subscriptions[0]?.items[0]).not.toHaveProperty('subscription')
    })
  })

  it('emite o produto cobrado dentro do plano, e não na assinatura', () => {
    const view = mapAplicationContextToView(context)

    expect(view.subscriptions[0]?.plan.product).toEqual({
      id: '43',
      name: 'ThinkZap (legado)',
      billingModel: 'subscription',
      active: true,
    })
    expect(view.subscriptions[0]).not.toHaveProperty('product')
  })

  it('serializa datas como string ISO 8601', () => {
    const view = mapAplicationContextToView(context)

    expect(view.subscriptions[0]?.currentPeriodStart).toBe(
      '2026-07-01T00:00:00.000Z',
    )
    expect(view.subscriptions[0]?.currentPeriodEnd).toBe(
      '2026-08-01T00:00:00.000Z',
    )
    expect(typeof view.aplication.createdAt).toBe('string')
  })

  it('emite o estado de conexão registrado no item, e null quando nunca registrado', () => {
    const view = mapAplicationContextToView({
      ...context,
      subscriptions: [
        {
          ...subscription,
          items: [
            { ...zApiItem, connected: true },
            { ...hubItem, connected: false },
            noneItem,
          ],
        },
      ],
    })

    expect(view.subscriptions[0]?.items.map(item => item.connected)).toEqual([
      true,
      false,
      null,
    ])
  })

  describe('metadata redigido', () => {
    it('emite provider e zApiInstanceId no caso ZAPI', () => {
      const view = mapAplicationContextToView(context)

      expect(view.subscriptions[0]?.items[0]?.metadata).toEqual({
        provider: 'ZAPI',
        zApiInstanceId: 'inst-1',
      })
    })

    it('emite channel e waba no caso HUBMESSAGE', () => {
      const view = mapAplicationContextToView(context)

      expect(view.subscriptions[0]?.items[1]?.metadata).toEqual({
        provider: 'HUBMESSAGE',
        hubmessageChannelId: 'chan-1',
        wabaId: 'waba-1',
      })
    })

    it('emite só o provider no caso NONE', () => {
      const view = mapAplicationContextToView(context)

      expect(view.subscriptions[0]?.items[2]?.metadata).toEqual({
        provider: 'NONE',
      })
    })

    it('NÃO emite zApiInstanceToken em nenhum lugar do payload', () => {
      const view = mapAplicationContextToView(context)

      // Chave ausente no objeto...
      expect(view.subscriptions[0]?.items[0]?.metadata).not.toHaveProperty(
        'zApiInstanceToken',
      )
      // ...e o valor não aparece em nenhum ponto da árvore serializada.
      const serialized = JSON.stringify(view)
      expect(serialized).not.toContain('zApiInstanceToken')
      expect(serialized).not.toContain('TOKEN-SUPER-SECRETO')
    })
  })

  it('serializa instalação sem espelho e sem assinatura', () => {
    const view = mapAplicationContextToView({
      customer,
      aplication: { ...aplication, spaId: null },
      subscriptions: [],
    })

    expect(view.aplication.spaId).toBeNull()
    expect(view.subscriptions).toEqual([])
  })
})
