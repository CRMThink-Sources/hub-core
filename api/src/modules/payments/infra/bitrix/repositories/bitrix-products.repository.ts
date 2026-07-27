import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { ProductRepository } from '@/modules/payments/domain/repositories/get-product.repository'
import { Product } from '@/modules/payments/domain/entities/product'
import { ProductNotFoundError } from '@/modules/payments/domain/errors/product-not-found.error'
import { env } from '@/config/env'
import {
  collectBitrixSpaProductToProduct,
  mapBitrixSpaProductToProduct,
} from '../mappers/product.mapper'

export class BitrixProductRepository implements ProductRepository {
  constructor(private readonly bitrix: BitrixClient) {}

  async getProduct(id: string): Promise<Product> {
    const response = await this.bitrix.getCrmItem(
      env.payments.spa.productEntityType,
      id,
    )

    const item = response.result?.item
    if (!item) throw new ProductNotFoundError(id)

    return mapBitrixSpaProductToProduct(item)
  }

  async getProducts(): Promise<Product[]> {
    const response = await this.bitrix.listCrmItems(
      env.payments.spa.productEntityType,
      {},
    )

    return collectBitrixSpaProductToProduct(response.result?.items ?? [])
  }
}
