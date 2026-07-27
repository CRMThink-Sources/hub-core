import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { PlanRepository } from '@/modules/payments/domain/repositories/get-plan.repository'
import { ProductRepository } from '@/modules/payments/domain/repositories/get-product.repository'
import { Plan } from '@/modules/payments/domain/entities/plan'
import { Product } from '@/modules/payments/domain/entities/product'
import { PlanNotFoundError } from '@/modules/payments/domain/errors/plan-not-found.error'
import { ProductNotFoundError } from '@/modules/payments/domain/errors/product-not-found.error'
import { env } from '@/config/env'
import {
  RawPlan,
  collectBitrixSpaPlanToRawPlan,
  mapBitrixSpaPlanToRawPlan,
} from '../mappers/plan.mapper'

export class BitrixPlanRepository implements PlanRepository {
  /**
   * @param products Deve vir decorado com `CachedProductRepository`. A SPA de
   * planos só devolve a referência do produto, então cada leitura hidrata o
   * `Product` — sem cache, isso vira uma chamada extra ao Bitrix por plano.
   */
  constructor(
    private readonly bitrix: BitrixClient,
    private readonly products: ProductRepository,
  ) {}

  async getPlan(id: string): Promise<Plan> {
    const response = await this.bitrix.getCrmItem(
      env.payments.spa.planEntityType,
      id,
    )

    const item = response.result?.item
    if (!item) throw new PlanNotFoundError(id)

    const rawPlan = mapBitrixSpaPlanToRawPlan(item)

    return {
      ...this.withoutProductId(rawPlan),
      product: await this.products.getProduct(rawPlan.productId),
    }
  }

  async getPlans(): Promise<Plan[]> {
    const response = await this.bitrix.listCrmItems(
      env.payments.spa.planEntityType,
      {},
    )

    const rawPlans = collectBitrixSpaPlanToRawPlan(response.result?.items ?? [])
    if (rawPlans.length === 0) return []

    const productsById = await this.resolveProducts(rawPlans)

    return rawPlans.map(rawPlan => {
      const product = productsById.get(rawPlan.productId)
      if (!product) throw new ProductNotFoundError(rawPlan.productId)

      return { ...this.withoutProductId(rawPlan), product }
    })
  }

  private async resolveProducts(
    rawPlans: RawPlan[],
  ): Promise<Map<string, Product>> {
    const products = await this.products.getProducts()
    const productsById = new Map(products.map(product => [product.id, product]))

    const missingIds = [
      ...new Set(
        rawPlans
          .map(rawPlan => rawPlan.productId)
          .filter(productId => !productsById.has(productId)),
      ),
    ]

    const missingProducts = await Promise.all(
      missingIds.map(
        async productId =>
          [productId, await this.products.getProduct(productId)] as const,
      ),
    )

    for (const [productId, product] of missingProducts) {
      productsById.set(productId, product)
    }

    return productsById
  }

  private withoutProductId(rawPlan: RawPlan): Omit<RawPlan, 'productId'> {
    const { productId: _productId, ...plan } = rawPlan
    return plan
  }
}
