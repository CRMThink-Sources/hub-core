import { describe, expect, it, vi } from 'vitest'
import { BitrixPlanRepository } from './bitrix-plans.repository'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { ProductRepository } from '@/modules/payments/domain/repositories/get-product.repository'
import { Product } from '@/modules/payments/domain/entities/product'
import { PlanNotFoundError } from '@/modules/payments/domain/errors/plan-not-found.error'
import { ProductNotFoundError } from '@/modules/payments/domain/errors/product-not-found.error'

const productOf = (id: string): Product => ({
  id,
  name: `Produto ${id}`,
  billingModel: 'subscription',
  active: true,
})

const planItem = (id: number, productId: string) => ({
  id,
  title: `Plano ${id}`,
  ufCrm89Product: `1134_${productId}`,
  ufCrm89Value: 4990,
  ufCrm89Interval: '13609',
  ufCrm89GatewayId: `price_${id}`,
  ufCrm89Active: true,
})

function makeProducts(catalog: Product[]) {
  const getProducts = vi.fn(() => Promise.resolve(catalog))
  const getProduct = vi.fn((id: string) => {
    const product = catalog.find(item => item.id === id)
    return product
      ? Promise.resolve(product)
      : Promise.reject(new ProductNotFoundError(id))
  })

  const repository: ProductRepository = { getProduct, getProducts }

  return { repository, getProduct, getProducts }
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

describe('BitrixPlanRepository', () => {
  describe('getPlan', () => {
    it('mapeia o plano e hidrata o produto', async () => {
      const products = makeProducts([productOf('42')])
      const bitrix = respondingWithItem(planItem(7, '42'))

      const plan = await new BitrixPlanRepository(
        bitrix,
        products.repository,
      ).getPlan('7')

      expect(plan).toEqual({
        id: '7',
        name: 'Plano 7',
        product: productOf('42'),
        amount: 4990,
        interval: 'monthly',
        gatewayId: 'price_7',
        active: true,
      })
    })

    it('lança PlanNotFoundError quando a SPA não devolve item', async () => {
      const products = makeProducts([])
      const bitrix = respondingWithItem(undefined)

      await expect(
        new BitrixPlanRepository(bitrix, products.repository).getPlan('999'),
      ).rejects.toThrow(PlanNotFoundError)
    })

    it('propaga ProductNotFoundError quando o produto vinculado sumiu', async () => {
      const products = makeProducts([])
      const bitrix = respondingWithItem(planItem(7, '42'))

      await expect(
        new BitrixPlanRepository(bitrix, products.repository).getPlan('7'),
      ).rejects.toThrow(ProductNotFoundError)
    })
  })

  describe('getPlans', () => {
    it('devolve lista vazia quando a SPA não devolve items', async () => {
      const products = makeProducts([])
      const bitrix = respondingWithItems()

      const plans = await new BitrixPlanRepository(
        bitrix,
        products.repository,
      ).getPlans()

      expect(plans).toEqual([])
      expect(products.getProducts).not.toHaveBeenCalled()
    })

    it('resolve produtos repetidos com uma única leitura do catálogo', async () => {
      const products = makeProducts([productOf('42'), productOf('43')])
      const bitrix = respondingWithItems([
        planItem(1, '42'),
        planItem(2, '42'),
        planItem(3, '43'),
        planItem(4, '42'),
      ])

      const plans = await new BitrixPlanRepository(
        bitrix,
        products.repository,
      ).getPlans()

      expect(plans.map(plan => plan.product.id)).toEqual([
        '42',
        '42',
        '43',
        '42',
      ])
      expect(products.getProducts).toHaveBeenCalledTimes(1)
      expect(products.getProduct).not.toHaveBeenCalled()
    })

    it('busca individualmente só os produtos ausentes da listagem', async () => {
      const products = makeProducts([productOf('42'), productOf('99')])
      // A listagem do catálogo devolve só o 42 — força o fallback para o 99.
      products.getProducts.mockResolvedValue([productOf('42')])

      const bitrix = respondingWithItems([
        planItem(1, '42'),
        planItem(2, '99'),
        planItem(3, '99'),
      ])

      const plans = await new BitrixPlanRepository(
        bitrix,
        products.repository,
      ).getPlans()

      expect(plans.map(plan => plan.product.id)).toEqual(['42', '99', '99'])
      expect(products.getProduct).toHaveBeenCalledTimes(1)
      expect(products.getProduct).toHaveBeenCalledWith('99')
    })
  })
})
