import { describe, expect, it, vi } from 'vitest'
import { HandleGatewayWebhookEvent } from './handle-gateway-webhook-event'
import { ActivateLineSubscription } from './activate-line-subscription'
import { ProviderResourceBilling } from './provider-resource-billing'
import { apiLogger } from '@/shared/infra/logger'
import type { Plan } from '@/modules/application/domain/entities/plan'
import type { Subscription } from '@/modules/application/domain/entities/subscription'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import type { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const NOW = new Date('2026-08-03T12:00:00.000Z')
const plusDays = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000)

const PAID_PLAN: Plan = {
  id: '7',
  name: 'Pro',
  product: {
    id: '42',
    name: 'ThinkZap',
    billingModel: 'subscription',
    active: true,
  },
  amount: 4990,
  interval: 'monthly',
  gatewayId: 'price_abc',
  active: true,
}

const aplication = {
  id: 'app-1',
  spaId: '512',
  customer: {
    id: 'domain-1',
    name: 'acme.bitrix24.com.br',
    memberId: 'member-1',
  },
  appCode: 'crmthink.thinkzap',
  title: 'ThinkZap — Acme',
  active: true,
  createdAt: NOW,
  updatedAt: NOW,
}

const lineItem: SubscriptionItem = {
  id: '77',
  name: 'WhatsApp',
  subscription: '99',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'inst-1',
    zApiInstanceToken: 'tok-1',
  },
}

const paid = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: '99',
  name: 'Assinatura',
  plan: PAID_PLAN,
  status: 'active',
  currentPeriodStart: NOW,
  currentPeriodEnd: plusDays(30),
  aplication,
  modality: 'stripe',
  gatewayId: 'sub_1',
  ...overrides,
})

const makeHandler = (
  options: {
    found?: Subscription | null
    contract?: Subscription[]
    items?: SubscriptionItem[]
    failWriteOn?: string[]
  } = {},
) => {
  const activateExecute = vi.fn(() =>
    Promise.resolve({ subscriptionId: '99', alreadyActive: false }),
  )
  const activate = {
    execute: activateExecute,
  } as unknown as ActivateLineSubscription

  // `found: null` = contrato ausente na SPA (evento fora de ordem).
  const contract =
    options.contract ??
    ('found' in options ? (options.found ? [options.found] : []) : [paid()])

  const listSubscriptionsByGatewayId = vi.fn(() => Promise.resolve(contract))
  const updateSubscription = vi.fn(
    (id: string, _patch: Record<string, unknown>) =>
      options.failWriteOn?.includes(id)
        ? Promise.reject(new Error('bitrix fora'))
        : Promise.resolve(paid({ id })),
  )

  const subscriptions = {
    getSubscription: vi.fn(),
    getSubscriptions: vi.fn(),
    getSubscriptionsByAplication: vi.fn(),
    listSubscriptionsByGatewayId,
    createSubscription: vi.fn(),
    updateSubscription,
  } as unknown as SubscriptionRepository

  const getSubscriptionItemsBySubscription = vi.fn(() =>
    Promise.resolve(options.items ?? [lineItem]),
  )
  const items = {
    getSubscriptionItem: vi.fn(),
    getSubscriptionItems: vi.fn(),
    getSubscriptionItemsBySubscription,
    createSubscriptionItem: vi.fn(),
    updateSubscriptionItem: vi.fn(),
    reparentSubscriptionItem: vi.fn(),
  } as unknown as SubscriptionItemRepository

  const subscribe = vi.fn(() => Promise.resolve())
  const unsubscribe = vi.fn(() => Promise.resolve())
  const providerBilling = {
    subscribe,
    unsubscribe,
  } as unknown as ProviderResourceBilling

  return {
    handler: new HandleGatewayWebhookEvent(
      activate,
      subscriptions,
      items,
      providerBilling,
    ),
    activateExecute,
    listSubscriptionsByGatewayId,
    updateSubscription,
    subscribe,
    unsubscribe,
  }
}

const CHECKOUT = {
  type: 'checkout.completed' as const,
  gatewaySubscriptionId: 'sub_1',
  installation: {
    domainId: 'domain-1',
    appCode: 'crmthink.thinkzap',
    planId: '7',
  },
  intent: { kind: 'convert' as const },
  currentPeriodStart: NOW,
  currentPeriodEnd: plusDays(30),
}

// Default 1 casa com o `lineItem` único: evita log de divergência nos outros testes.
const updated = (status: Subscription['status'], totalLineQuantity = 1) => ({
  type: 'subscription.updated' as const,
  gatewaySubscriptionId: 'sub_1',
  status,
  currentPeriodStart: NOW,
  currentPeriodEnd: plusDays(30),
  totalLineQuantity,
})

const DELETED = {
  type: 'subscription.deleted' as const,
  gatewaySubscriptionId: 'sub_1',
}

describe('HandleGatewayWebhookEvent', () => {
  describe('checkout.completed', () => {
    it('executa a ativação com o metadata da instalação', async () => {
      const deps = makeHandler()

      await deps.handler.execute(CHECKOUT)

      expect(deps.activateExecute).toHaveBeenCalledWith({
        domainId: 'domain-1',
        appCode: 'crmthink.thinkzap',
        planId: '7',
        gatewaySubscriptionId: 'sub_1',
        intent: { kind: 'convert' },
        currentPeriodStart: NOW,
        currentPeriodEnd: plusDays(30),
      })
    })

    it('repassa a intenção de acrescentar linha', async () => {
      const deps = makeHandler()

      await deps.handler.execute({
        ...CHECKOUT,
        intent: { kind: 'add-line', provider: 'HUBMESSAGE', planId: '8' },
      })

      expect(deps.activateExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          intent: { kind: 'add-line', provider: 'HUBMESSAGE', planId: '8' },
        }),
      )
    })
  })

  describe('subscription.updated', () => {
    it('grava status e período', async () => {
      const deps = makeHandler({
        found: paid({ status: 'active', currentPeriodEnd: plusDays(1) }),
      })

      await deps.handler.execute(updated('past_due'))

      expect(deps.updateSubscription).toHaveBeenCalledWith('99', {
        status: 'past_due',
        currentPeriodStart: NOW,
        currentPeriodEnd: plusDays(30),
      })
    })

    it('entrar em past_due não toca o provider', async () => {
      const deps = makeHandler({ found: paid({ status: 'active' }) })

      await deps.handler.execute(updated('past_due'))

      expect(deps.subscribe).not.toHaveBeenCalled()
      expect(deps.unsubscribe).not.toHaveBeenCalled()
    })

    it('sair de past_due para active não chama subscribe de novo', async () => {
      const deps = makeHandler({ found: paid({ status: 'past_due' }) })

      await deps.handler.execute(updated('active'))

      expect(deps.updateSubscription).toHaveBeenCalledWith(
        '99',
        expect.objectContaining({ status: 'active' }),
      )
      expect(deps.subscribe).not.toHaveBeenCalled()
      expect(deps.unsubscribe).not.toHaveBeenCalled()
    })

    it('reentrega do mesmo evento não reescreve', async () => {
      const deps = makeHandler({
        found: paid({ status: 'past_due', currentPeriodEnd: plusDays(30) }),
      })

      await deps.handler.execute(updated('past_due'))

      expect(deps.updateSubscription).not.toHaveBeenCalled()
    })

    it('gatewayId desconhecido é ignorado com log', async () => {
      const deps = makeHandler({ found: null })

      await expect(
        deps.handler.execute(updated('active')),
      ).resolves.toBeUndefined()

      expect(deps.updateSubscription).not.toHaveBeenCalled()
      expect(apiLogger.info).toHaveBeenCalled()
    })
  })

  describe('subscription.deleted', () => {
    it('grava cancelled e desassina o recurso no provider', async () => {
      const deps = makeHandler({ found: paid({ status: 'active' }) })

      await deps.handler.execute(DELETED)

      expect(deps.updateSubscription).toHaveBeenCalledWith('99', {
        status: 'cancelled',
      })
      expect(deps.unsubscribe).toHaveBeenCalledWith(lineItem)
    })

    it('cancela na SPA antes de desassinar', async () => {
      const order: string[] = []
      const deps = makeHandler({ found: paid({ status: 'active' }) })

      deps.updateSubscription.mockImplementation(() => {
        order.push('spa')
        return Promise.resolve(paid())
      })
      deps.unsubscribe.mockImplementation(() => {
        order.push('unsubscribe')
        return Promise.resolve()
      })

      await deps.handler.execute(DELETED)

      expect(order).toEqual(['spa', 'unsubscribe'])
    })

    it('desassina todas as linhas da assinatura', async () => {
      const second = { ...lineItem, id: '78' }
      const deps = makeHandler({
        found: paid({ status: 'active' }),
        items: [lineItem, second],
      })

      await deps.handler.execute(DELETED)

      expect(deps.unsubscribe).toHaveBeenCalledTimes(2)
    })

    it('gatewayId desconhecido é ignorado com log', async () => {
      const deps = makeHandler({ found: null })

      await expect(deps.handler.execute(DELETED)).resolves.toBeUndefined()

      expect(deps.updateSubscription).not.toHaveBeenCalled()
      expect(deps.unsubscribe).not.toHaveBeenCalled()
      expect(apiLogger.info).toHaveBeenCalled()
    })

    it('reentrega em assinatura já cancelada não reescreve nem desassina de novo', async () => {
      const deps = makeHandler({ found: paid({ status: 'cancelled' }) })

      await deps.handler.execute(DELETED)

      expect(deps.updateSubscription).not.toHaveBeenCalled()
      expect(deps.unsubscribe).not.toHaveBeenCalled()
    })
  })

  describe('evento não tratado', () => {
    it('é registrado e não escreve nada', async () => {
      const deps = makeHandler()

      await expect(
        deps.handler.execute({ type: 'ignored', name: 'invoice.paid' }),
      ).resolves.toBeUndefined()

      expect(deps.listSubscriptionsByGatewayId).not.toHaveBeenCalled()
      expect(deps.updateSubscription).not.toHaveBeenCalled()
      expect(deps.activateExecute).not.toHaveBeenCalled()
      expect(apiLogger.info).toHaveBeenCalled()
    })
  })

  describe('contrato com mais de uma assinatura', () => {
    const sibling = paid({ id: '100', status: 'active' })

    it('escreve status e período em todas as assinaturas do contrato', async () => {
      const deps = makeHandler({ contract: [paid(), sibling] })

      await deps.handler.execute({
        type: 'subscription.updated',
        gatewaySubscriptionId: 'sub_1',
        status: 'past_due',
        currentPeriodStart: NOW,
        currentPeriodEnd: plusDays(60),
        totalLineQuantity: 2,
      })

      expect(deps.updateSubscription.mock.calls.map(call => call[0])).toEqual([
        '99',
        '100',
      ])
    })

    it('falha numa irmã não impede a escrita nas outras', async () => {
      const deps = makeHandler({
        contract: [paid(), sibling],
        failWriteOn: ['99'],
      })

      await expect(
        deps.handler.execute({
          type: 'subscription.updated',
          gatewaySubscriptionId: 'sub_1',
          status: 'past_due',
          currentPeriodStart: NOW,
          currentPeriodEnd: plusDays(60),
          totalLineQuantity: 2,
        }),
      ).resolves.toBeUndefined()

      expect(deps.updateSubscription.mock.calls.map(call => call[0])).toEqual([
        '99',
        '100',
      ])
      expect(apiLogger.error).toHaveBeenCalled()
    })

    it('cancela as duas e desassina as linhas de cada uma', async () => {
      const deps = makeHandler({ contract: [paid(), sibling] })

      await deps.handler.execute({
        type: 'subscription.deleted',
        gatewaySubscriptionId: 'sub_1',
      })

      expect(deps.updateSubscription.mock.calls.map(call => call[0])).toEqual([
        '99',
        '100',
      ])
      expect(deps.unsubscribe).toHaveBeenCalledTimes(2)
    })

    it('registra quantidade divergente sem criar nem cancelar linha', async () => {
      const deps = makeHandler({ contract: [paid()] })

      await deps.handler.execute(updated('active', 5))

      expect(apiLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ gatewayQuantity: 5, spaLineCount: 1 }),
        expect.stringMatching(/diverge das linhas na SPA/),
      )
    })

    it('não registra divergência quando a quantidade bate', async () => {
      vi.mocked(apiLogger.warn).mockClear()
      const deps = makeHandler({ contract: [paid()] })

      await deps.handler.execute(updated('past_due', 1))

      expect(apiLogger.warn).not.toHaveBeenCalled()
    })

    it('não desassina a linha da irmã cuja escrita falhou', async () => {
      const deps = makeHandler({
        contract: [paid(), sibling],
        failWriteOn: ['99'],
      })

      await deps.handler.execute({
        type: 'subscription.deleted',
        gatewaySubscriptionId: 'sub_1',
      })

      expect(deps.unsubscribe).toHaveBeenCalledTimes(1)
    })
  })
})
