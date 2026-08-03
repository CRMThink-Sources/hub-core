import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { describe, expect, it, vi } from 'vitest'
import { GetAplicationContext } from './get-aplication-context'
import { Aplication } from '@/modules/application/domain/entities/aplication'
import { Customer } from '@/modules/application/domain/entities/customer'
import { Subscription } from '@/modules/application/domain/entities/subscription'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { AplicationNotFoundError } from '@/modules/application/domain/errors/aplication-not-found.error'
import { CustomerNotFoundError } from '@/modules/application/domain/errors/customer-not-found.error'
import { AplicationRepository } from '@/modules/application/domain/repositories/aplication.repository'
import { CustomerRepository } from '@/modules/application/domain/repositories/customer.repository'
import { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'

const customer: Customer = {
  id: 'domain-1',
  name: 'acme.bitrix24.com.br',
  memberId: 'member-1',
}

const aplicationOf = (spaId: string | null): Aplication => ({
  id: 'app-1',
  spaId,
  customer,
  appCode: 'crmthink.thinkzap',
  title: 'ThinkZap — Acme',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
})

const product = {
  id: '42',
  name: 'ThinkZap',
  billingModel: 'subscription',
  active: true,
}

const subscriptionOf = (id: string): Subscription => ({
  id,
  name: `ThinkZap Pro — ${id}`,
  plan: {
    id: '7',
    name: 'ThinkZap Pro',
    product,
    amount: 4990,
    interval: 'monthly',
    gatewayId: 'price_abc',
    active: true,
  },
  status: 'active',
  currentPeriodStart: new Date('2026-07-01T00:00:00.000Z'),
  currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
  aplication: aplicationOf('512'),
  gatewayId: `sub_${id}`,
})

const itemOf = (id: string, subscription: string): SubscriptionItem => ({
  id,
  name: `Conector ${id}`,
  subscription,
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: `inst-${id}`,
    zApiInstanceToken: `tok-${id}`,
  },
})

function makeCustomers(entity: Customer | Error = customer) {
  const getCustomer = vi.fn(() =>
    entity instanceof Error ? Promise.reject(entity) : Promise.resolve(entity),
  )

  return {
    repository: { getCustomer } as unknown as CustomerRepository,
    getCustomer,
  }
}

function makeAplications(entity: Aplication | null = aplicationOf('512')) {
  const getAplicationByInstall = vi.fn(() => Promise.resolve(entity))

  return {
    repository: {
      getAplicationByInstall,
    } as unknown as AplicationRepository,
    getAplicationByInstall,
  }
}

function makeSubscriptions(result: Subscription[] | Error = []) {
  const getSubscriptionsByAplication = vi.fn(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
  )

  return {
    repository: {
      getSubscriptionsByAplication,
    } as unknown as SubscriptionRepository,
    getSubscriptionsByAplication,
  }
}

/** Devolve os itens de `bySubscription`; ids desconhecidos viram `[]`. */
function makeItems(
  bySubscription: Record<string, SubscriptionItem[]> | Error = {},
) {
  const getSubscriptionItemsBySubscription = vi.fn((subscriptionId: string) =>
    bySubscription instanceof Error
      ? Promise.reject(bySubscription)
      : Promise.resolve(bySubscription[subscriptionId] ?? []),
  )

  return {
    repository: {
      getSubscriptionItemsBySubscription,
    } as unknown as SubscriptionItemRepository,
    getSubscriptionItemsBySubscription,
  }
}

type Deps = {
  customers?: ReturnType<typeof makeCustomers>
  aplications?: ReturnType<typeof makeAplications>
  subscriptions?: ReturnType<typeof makeSubscriptions>
  items?: ReturnType<typeof makeItems>
}

const makeUseCase = (deps: Deps = {}) => {
  const customers = deps.customers ?? makeCustomers()
  const aplications = deps.aplications ?? makeAplications()
  const subscriptions = deps.subscriptions ?? makeSubscriptions()
  const items = deps.items ?? makeItems()

  const useCase = new GetAplicationContext(
    customers.repository,
    aplications.repository,
    subscriptions.repository,
    items.repository,
  )

  return { useCase, customers, aplications, subscriptions, items }
}

const input = { domainId: 'domain-1', appCode: 'crmthink.thinkzap' }

describe('GetAplicationContext', () => {
  it('monta a árvore com os itens agrupados na assinatura certa', async () => {
    const { useCase } = makeUseCase({
      subscriptions: makeSubscriptions([
        subscriptionOf('21'),
        subscriptionOf('22'),
      ]),
      items: makeItems({
        '21': [itemOf('77', '21'), itemOf('78', '21')],
        '22': [itemOf('79', '22')],
      }),
    })

    const context = await useCase.execute(input)

    expect(context.customer).toEqual(customer)
    expect(context.aplication.id).toBe('app-1')
    expect(context.subscriptions.map(s => s.id)).toEqual(['21', '22'])
    expect(context.subscriptions[0]?.items.map(i => i.id)).toEqual(['77', '78'])
    expect(context.subscriptions[1]?.items.map(i => i.id)).toEqual(['79'])
  })

  it('resolve a instalação pelo host do cliente e pelo appCode do token', async () => {
    const { useCase, customers, aplications } = makeUseCase()

    await useCase.execute(input)

    expect(customers.getCustomer).toHaveBeenCalledWith('domain-1')
    expect(aplications.getAplicationByInstall).toHaveBeenCalledWith({
      domain: 'acme.bitrix24.com.br',
      appCode: 'crmthink.thinkzap',
    })
  })

  it('devolve items: [] para assinatura sem item', async () => {
    const { useCase } = makeUseCase({
      subscriptions: makeSubscriptions([subscriptionOf('21')]),
      items: makeItems({}),
    })

    const context = await useCase.execute(input)

    expect(context.subscriptions[0]?.items).toEqual([])
  })

  describe('instalação sem espelho na SPA', () => {
    it('devolve subscriptions: [] sem consultar a SPA de assinaturas', async () => {
      const subscriptions = makeSubscriptions([subscriptionOf('21')])
      const { useCase } = makeUseCase({
        aplications: makeAplications(aplicationOf(null)),
        subscriptions,
      })

      const context = await useCase.execute(input)

      expect(context.subscriptions).toEqual([])
      expect(context.aplication.spaId).toBeNull()
      expect(subscriptions.getSubscriptionsByAplication).not.toHaveBeenCalled()
    })

    it('não é confundido com instalação espelhada e sem contrato', async () => {
      const { useCase } = makeUseCase({ subscriptions: makeSubscriptions([]) })

      const context = await useCase.execute(input)

      expect(context.subscriptions).toEqual([])
      expect(context.aplication.spaId).toBe('512')
    })
  })

  describe('erros', () => {
    it('lança AplicationNotFoundError quando não há instalação para o par', async () => {
      const { useCase } = makeUseCase({ aplications: makeAplications(null) })

      await expect(useCase.execute(input)).rejects.toThrow(
        AplicationNotFoundError,
      )
    })

    it('propaga CustomerNotFoundError sem consultar a instalação', async () => {
      const aplications = makeAplications()
      const { useCase } = makeUseCase({
        customers: makeCustomers(new CustomerNotFoundError('domain-1')),
        aplications,
      })

      await expect(useCase.execute(input)).rejects.toThrow(
        CustomerNotFoundError,
      )
      expect(aplications.getAplicationByInstall).not.toHaveBeenCalled()
    })

    it('propaga falha na listagem de assinaturas em vez de devolver []', async () => {
      const { useCase } = makeUseCase({
        subscriptions: makeSubscriptions(new Error('bitrix down')),
      })

      await expect(useCase.execute(input)).rejects.toThrow('bitrix down')
    })

    it('propaga falha na listagem de itens', async () => {
      const { useCase } = makeUseCase({
        subscriptions: makeSubscriptions([subscriptionOf('21')]),
        items: makeItems(new Error('bitrix down')),
      })

      await expect(useCase.execute(input)).rejects.toThrow('bitrix down')
    })
  })
})
