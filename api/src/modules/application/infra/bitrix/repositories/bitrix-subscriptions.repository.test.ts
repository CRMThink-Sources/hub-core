import { describe, expect, it, vi } from 'vitest'
import { BitrixSubscriptionRepository } from './bitrix-subscriptions.repository'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { PlanRepository } from '@/modules/application/domain/repositories/get-plan.repository'
import { AplicationRepository } from '@/modules/application/domain/repositories/aplication.repository'
import { Plan } from '@/modules/application/domain/entities/plan'
import { Product } from '@/modules/application/domain/entities/product'
import { Aplication } from '@/modules/application/domain/entities/aplication'
import { SubscriptionNotFoundError } from '@/modules/application/domain/errors/subscription-not-found.error'
import { PlanNotFoundError } from '@/modules/application/domain/errors/plan-not-found.error'
import { AplicationNotFoundError } from '@/modules/application/domain/errors/aplication-not-found.error'
import { APLICATION_PARENT_FIELD } from '../mappers/subscription.mapper'
import { env } from '@/config/env'

const productOf = (id: string): Product => ({
  id,
  name: `Produto ${id}`,
  billingModel: 'subscription',
  active: true,
})

const planOf = (id: string): Plan => ({
  id,
  name: `Plano ${id}`,
  product: productOf('42'),
  amount: 4990,
  interval: 'monthly',
  gatewayId: `price_${id}`,
  active: true,
})

const aplicationOf = (spaId: string): Aplication => ({
  id: `app-${spaId}`,
  spaId,
  customer: {
    id: 'domain-1',
    name: 'acme.bitrix24.com.br',
    memberId: 'member-1',
  },
  appCode: 'thinkerszap',
  title: 'ThinkersZap — Acme',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
})

const subscriptionItem = (
  id: number,
  planId: string,
  aplicationSpaId = 512,
) => ({
  id,
  title: `Assinatura ${id}`,
  ufCrm91Plan: planId,
  [APLICATION_PARENT_FIELD]: aplicationSpaId,
  ufCrm91Status: '13617',
  ufCrm91CurrentPeriodStart: '2026-07-01T00:00:00.000Z',
  ufCrm91CurrentPeriodEnd: '2026-08-01T00:00:00.000Z',
  ufCrm91GatewayId: `sub_${id}`,
})

function makePlans(catalog: Plan[]) {
  const getPlans = vi.fn(() => Promise.resolve(catalog))
  const getPlan = vi.fn((id: string) => {
    const plan = catalog.find(item => item.id === id)
    return plan
      ? Promise.resolve(plan)
      : Promise.reject(new PlanNotFoundError(id))
  })

  const repository: PlanRepository = { getPlan, getPlans }

  return { repository, getPlan, getPlans }
}

/**
 * O repositório de assinaturas **não** recebe produtos: o produto cobrado vem em
 * `plan.product`. Os dublês existem só para afirmar que nenhum dos dois métodos é
 * chamado por este caminho.
 */
function makeProducts(catalog: Product[] = [productOf('42')]) {
  const getProducts = vi.fn(() => Promise.resolve(catalog))
  const getProduct = vi.fn((id: string) =>
    Promise.resolve(catalog.find(item => item.id === id)),
  )

  return { getProduct, getProducts }
}

/** Resolve qualquer `spaId` de `known`; os demais viram `null` (sem instalação). */
function makeAplications(known: string[] = ['512']) {
  const getAplicationBySpaId = vi.fn((spaId: string) =>
    Promise.resolve(known.includes(spaId) ? aplicationOf(spaId) : null),
  )

  const repository = {
    getAplicationBySpaId,
  } as unknown as AplicationRepository

  return { repository, getAplicationBySpaId }
}

const makeBitrix = (overrides: Record<string, unknown>) =>
  overrides as unknown as BitrixClient

const respondingWithItem = (item: unknown) =>
  makeBitrix({ getCrmItem: vi.fn(() => Promise.resolve({ result: { item } })) })

const respondingWithItems = (items?: unknown[]) =>
  makeBitrix({
    listCrmItems: vi.fn(() =>
      Promise.resolve({ result: items ? { items } : {} }),
    ),
  })

type Deps = {
  plans?: PlanRepository
  aplications?: AplicationRepository
}

const makeRepository = (bitrix: BitrixClient, deps: Deps = {}) =>
  new BitrixSubscriptionRepository(
    bitrix,
    deps.plans ?? makePlans([planOf('7')]).repository,
    deps.aplications ?? makeAplications().repository,
  )

describe('BitrixSubscriptionRepository', () => {
  describe('getSubscription', () => {
    it('mapeia a assinatura e hidrata plano, produto e aplicação', async () => {
      const plans = makePlans([planOf('7')])
      const bitrix = respondingWithItem(subscriptionItem(21, '7'))

      const subscription = await makeRepository(bitrix, {
        plans: plans.repository,
      }).getSubscription('21')

      expect(subscription).toEqual({
        id: '21',
        name: 'Assinatura 21',
        plan: planOf('7'),
        aplication: aplicationOf('512'),
        status: 'active',
        currentPeriodStart: new Date('2026-07-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
        gatewayId: 'sub_21',
        // O item de teste não tem o campo de modalidade: leitura tolerante resolve
        // `manual`, que é o estado de toda assinatura anterior ao campo existir.
        modality: 'manual',
      })
    })

    it('alcança o produto cobrado pelo plano', async () => {
      const plans = makePlans([planOf('7')])
      const bitrix = respondingWithItem(subscriptionItem(21, '7'))

      const subscription = await makeRepository(bitrix, {
        plans: plans.repository,
      }).getSubscription('21')

      // A SPA 1142 não tem campo de produto: `plan.product` é a única referência.
      expect(subscription.plan.product.id).toBe('42')
      expect(subscription).not.toHaveProperty('product')
    })

    it('resolve o cliente pela aplicação, sem leitura adicional', async () => {
      const bitrix = respondingWithItem(subscriptionItem(21, '7'))

      const subscription = await makeRepository(bitrix).getSubscription('21')

      expect(subscription.aplication.customer.name).toBe('acme.bitrix24.com.br')
    })

    it('lança SubscriptionNotFoundError quando a SPA não devolve item', async () => {
      const bitrix = respondingWithItem(undefined)

      await expect(
        makeRepository(bitrix).getSubscription('999'),
      ).rejects.toThrow(SubscriptionNotFoundError)
    })

    it('propaga PlanNotFoundError quando o plano vinculado sumiu', async () => {
      const plans = makePlans([])
      const bitrix = respondingWithItem(subscriptionItem(21, '7'))

      await expect(
        makeRepository(bitrix, { plans: plans.repository }).getSubscription(
          '21',
        ),
      ).rejects.toThrow(PlanNotFoundError)
    })

    it('lança AplicationNotFoundError quando o parent não tem instalação', async () => {
      const aplications = makeAplications([])
      const bitrix = respondingWithItem(subscriptionItem(21, '7'))

      await expect(
        makeRepository(bitrix, {
          aplications: aplications.repository,
        }).getSubscription('21'),
      ).rejects.toThrow(AplicationNotFoundError)
    })
  })

  describe('getSubscriptions', () => {
    it('devolve lista vazia quando a SPA não devolve items', async () => {
      const plans = makePlans([])
      const aplications = makeAplications([])
      const bitrix = respondingWithItems()

      const subscriptions = await makeRepository(bitrix, {
        plans: plans.repository,
        aplications: aplications.repository,
      }).getSubscriptions()

      expect(subscriptions).toEqual([])
      expect(plans.getPlans).not.toHaveBeenCalled()
      expect(aplications.getAplicationBySpaId).not.toHaveBeenCalled()
    })

    it('resolve planos repetidos com uma única leitura do catálogo', async () => {
      const plans = makePlans([planOf('7'), planOf('8')])
      const bitrix = respondingWithItems([
        subscriptionItem(1, '7'),
        subscriptionItem(2, '7'),
        subscriptionItem(3, '8'),
        subscriptionItem(4, '7'),
      ])

      const subscriptions = await makeRepository(bitrix, {
        plans: plans.repository,
      }).getSubscriptions()

      expect(subscriptions.map(s => s.plan.id)).toEqual(['7', '7', '8', '7'])
      expect(plans.getPlans).toHaveBeenCalledTimes(1)
      expect(plans.getPlan).not.toHaveBeenCalled()
    })

    it('busca individualmente só os planos ausentes da listagem', async () => {
      const plans = makePlans([planOf('7'), planOf('99')])
      // A listagem do catálogo devolve só o 7 — força o fallback para o 99.
      plans.getPlans.mockResolvedValue([planOf('7')])

      const bitrix = respondingWithItems([
        subscriptionItem(1, '7'),
        subscriptionItem(2, '99'),
        subscriptionItem(3, '99'),
      ])

      const subscriptions = await makeRepository(bitrix, {
        plans: plans.repository,
      }).getSubscriptions()

      expect(subscriptions.map(s => s.plan.id)).toEqual(['7', '99', '99'])
      expect(plans.getPlan).toHaveBeenCalledTimes(1)
      expect(plans.getPlan).toHaveBeenCalledWith('99')
    })

    it('não consulta a SPA de produtos: o produto vem do plano', async () => {
      const products = makeProducts([productOf('42')])
      const plans = makePlans([planOf('7')])
      const bitrix = respondingWithItems([
        subscriptionItem(1, '7'),
        subscriptionItem(2, '7'),
      ])

      const subscriptions = await makeRepository(bitrix, {
        plans: plans.repository,
      }).getSubscriptions()

      expect(subscriptions.map(s => s.plan.product.id)).toEqual(['42', '42'])
      expect(products.getProduct).not.toHaveBeenCalled()
      expect(products.getProducts).not.toHaveBeenCalled()
    })

    it('resolve cada aplicação repetida uma única vez', async () => {
      const aplications = makeAplications(['512', '900'])
      const bitrix = respondingWithItems([
        subscriptionItem(1, '7', 512),
        subscriptionItem(2, '7', 512),
        subscriptionItem(3, '7', 900),
      ])

      const subscriptions = await makeRepository(bitrix, {
        aplications: aplications.repository,
      }).getSubscriptions()

      expect(subscriptions.map(s => s.aplication.spaId)).toEqual([
        '512',
        '512',
        '900',
      ])
      expect(aplications.getAplicationBySpaId).toHaveBeenCalledTimes(2)
    })

    it('propaga PlanNotFoundError em vez de omitir a assinatura da listagem', async () => {
      const plans = makePlans([planOf('7')])
      const bitrix = respondingWithItems([
        subscriptionItem(1, '7'),
        subscriptionItem(2, '404'),
      ])

      await expect(
        makeRepository(bitrix, { plans: plans.repository }).getSubscriptions(),
      ).rejects.toThrow(PlanNotFoundError)
    })

    it('propaga AplicationNotFoundError em vez de omitir a assinatura', async () => {
      const aplications = makeAplications(['512'])
      const bitrix = respondingWithItems([
        subscriptionItem(1, '7', 512),
        subscriptionItem(2, '7', 999),
      ])

      await expect(
        makeRepository(bitrix, {
          aplications: aplications.repository,
        }).getSubscriptions(),
      ).rejects.toThrow(AplicationNotFoundError)
    })
  })

  describe('getSubscriptionsByAplication', () => {
    it('filtra no Bitrix pelo campo parent da aplicação', async () => {
      const listCrmItems = vi.fn(() =>
        Promise.resolve({ result: { items: [subscriptionItem(1, '7', 512)] } }),
      )
      const bitrix = makeBitrix({ listCrmItems })

      const subscriptions =
        await makeRepository(bitrix).getSubscriptionsByAplication('512')

      expect(listCrmItems).toHaveBeenCalledWith(
        env.payments.spa.subscriptionEntityType,
        { [APLICATION_PARENT_FIELD]: '512' },
      )
      expect(subscriptions.map(s => s.aplication.spaId)).toEqual(['512'])
    })

    it('devolve lista vazia quando a aplicação não tem assinaturas', async () => {
      const bitrix = respondingWithItems([])

      const subscriptions =
        await makeRepository(bitrix).getSubscriptionsByAplication('999')

      expect(subscriptions).toEqual([])
    })
  })

  describe('listSubscriptionsByGatewayId', () => {
    it('filtra no Bitrix pelo campo de id do gateway', async () => {
      const listCrmItems = vi.fn(() =>
        Promise.resolve({ result: { items: [subscriptionItem(1, '7', 512)] } }),
      )
      const bitrix = makeBitrix({ listCrmItems })

      await makeRepository(bitrix).listSubscriptionsByGatewayId('sub_1')

      expect(listCrmItems).toHaveBeenCalledWith(
        env.payments.spa.subscriptionEntityType,
        { ufCrm91GatewayId: 'sub_1' },
      )
    })

    /**
     * Duas assinaturas com o mesmo id no gateway é caso de negócio: uma instalação
     * cobrada por dois planos tem uma por plano. Cortar para a primeira faria o
     * webhook escrever status em metade do contrato.
     */
    it('devolve todas as assinaturas do mesmo id de gateway', async () => {
      const bitrix = respondingWithItems([
        { ...subscriptionItem(1, '7', 512), ufCrm91GatewayId: 'sub_1' },
        { ...subscriptionItem(2, '8', 512), ufCrm91GatewayId: 'sub_1' },
      ])

      const subscriptions = await makeRepository(bitrix, {
        plans: makePlans([planOf('7'), planOf('8')]).repository,
      }).listSubscriptionsByGatewayId('sub_1')

      expect(subscriptions.map(subscription => subscription.id)).toEqual([
        '1',
        '2',
      ])
    })

    it('devolve lista vazia quando nenhuma assinatura tem o id', async () => {
      const bitrix = respondingWithItems([])

      const subscriptions =
        await makeRepository(bitrix).listSubscriptionsByGatewayId('sub_ausente')

      expect(subscriptions).toEqual([])
    })
  })

  describe('createSubscription', () => {
    const input = {
      name: 'Assinatura 21',
      planId: '7',
      aplicationSpaId: '512',
      status: 'trialing' as const,
      currentPeriodStart: new Date('2026-07-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
    }

    it('grava na SPA e devolve a assinatura relida', async () => {
      const createCrmItem = vi.fn(() =>
        Promise.resolve({ result: { item: { id: '21' } } }),
      )
      const getCrmItem = vi.fn(() =>
        Promise.resolve({ result: { item: subscriptionItem(21, '7') } }),
      )
      const bitrix = makeBitrix({ createCrmItem, getCrmItem })

      const subscription =
        await makeRepository(bitrix).createSubscription(input)

      expect(createCrmItem).toHaveBeenCalledWith(
        env.payments.spa.subscriptionEntityType,
        expect.objectContaining({
          title: 'Assinatura 21',
          ufCrm91Plan: '7',
          [APLICATION_PARENT_FIELD]: '512',
          ufCrm91Status: '13619',
        }),
      )
      // Releitura: o status devolvido é o da SPA, não o do input.
      expect(getCrmItem).toHaveBeenCalledWith(
        env.payments.spa.subscriptionEntityType,
        '21',
      )
      expect(subscription.status).toBe('active')
    })

    it('omite o gatewayId do payload quando o input não traz', async () => {
      const createCrmItem = vi.fn(
        (_entityTypeId: number, _fields: Record<string, unknown>) =>
          Promise.resolve({ result: { item: { id: '21' } } }),
      )
      const bitrix = makeBitrix({
        createCrmItem,
        getCrmItem: vi.fn(() =>
          Promise.resolve({ result: { item: subscriptionItem(21, '7') } }),
        ),
      })

      await makeRepository(bitrix).createSubscription(input)

      expect(createCrmItem.mock.calls[0]?.[1]).not.toHaveProperty(
        'ufCrm91GatewayId',
      )
    })

    it('falha quando o Bitrix não devolve o id do item criado', async () => {
      const bitrix = makeBitrix({
        createCrmItem: vi.fn(() => Promise.resolve({ result: {} })),
      })

      await expect(
        makeRepository(bitrix).createSubscription(input),
      ).rejects.toThrow(/id da assinatura criada/)
    })
  })

  describe('updateSubscription', () => {
    it('envia só os campos do patch e devolve a assinatura relida', async () => {
      const updateCrmItem = vi.fn(() =>
        Promise.resolve({ result: { id: '21' } }),
      )
      const getCrmItem = vi.fn(() =>
        Promise.resolve({ result: { item: subscriptionItem(21, '7') } }),
      )
      const bitrix = makeBitrix({ updateCrmItem, getCrmItem })

      const subscription = await makeRepository(bitrix).updateSubscription(
        '21',
        { status: 'cancelled' },
      )

      expect(updateCrmItem).toHaveBeenCalledWith(
        env.payments.spa.subscriptionEntityType,
        '21',
        { ufCrm91Status: '13623' },
      )
      // O estado devolvido vem da releitura, não do patch.
      expect(subscription.status).toBe('active')
    })
  })
})
