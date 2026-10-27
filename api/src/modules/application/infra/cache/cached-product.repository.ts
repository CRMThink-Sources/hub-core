import type IORedis from 'ioredis'
import z from 'zod'
import { Product } from '@/modules/application/domain/entities/product'
import { ProductRepository } from '@/modules/application/domain/repositories/get-product.repository'
import { apiLogger } from '@/shared/infra/logger'
import { productKey, productListKey } from './keys'
import { loadWithStaleFallback, writeStale } from './stale-if-error'

const PRODUCT_TTL_SECONDS = 5 * 60

const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  billingModel: z.string(),
  active: z.boolean(),
})

const productListSchema = z.array(productSchema)

/** Entrada corrompida no Redis não pode derrubar a request — vira miss. */
function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Decorator de cache sobre qualquer `ProductRepository`.
 * Não conhece a origem dos dados — falha de Redis nunca derruba a leitura.
 */
export class CachedProductRepository implements ProductRepository {
  constructor(
    private readonly inner: ProductRepository,
    private readonly redis: IORedis,
  ) {}

  async getProduct(id: string): Promise<Product> {
    const cachedProduct = await this.read(productKey(id), productSchema)
    if (cachedProduct) return cachedProduct

    const { value: product, stale } = await loadWithStaleFallback({
      redis: this.redis,
      key: productKey(id),
      schema: productSchema,
      family: 'Product',
      load: () => this.inner.getProduct(id),
    })
    if (!stale) await this.write(productKey(id), product)

    return product
  }

  async getProducts(): Promise<Product[]> {
    const cachedProducts = await this.read(productListKey(), productListSchema)
    if (cachedProducts) return cachedProducts

    const { value: products, stale } = await loadWithStaleFallback({
      redis: this.redis,
      key: productListKey(),
      schema: productListSchema,
      family: 'Product',
      load: () => this.inner.getProducts(),
    })
    if (!stale) await this.write(productListKey(), products)

    return products
  }

  /** Miss, falha de Redis e entrada com shape velho são todos tratados como miss. */
  private async read<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
    let hit: string | null
    try {
      hit = await this.redis.get(key)
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', key, error },
        'Product cache read failed — falling back to source',
      )
      return null
    }

    if (!hit) return null

    const parsed = schema.safeParse(safeJsonParse(hit))
    if (!parsed.success) {
      apiLogger.warn(
        { app: 'payments', key, issues: parsed.error.issues },
        'Product cache entry has stale shape — discarding',
      )
      return null
    }

    return parsed.data
  }

  /** Grava a fresca (TTL curto) e a reserva de 24 h usada só se o Bitrix falhar. */
  private async write(key: string, value: unknown): Promise<void> {
    await writeStale(this.redis, key, value)
    try {
      await this.redis.set(
        key,
        JSON.stringify(value),
        'EX',
        PRODUCT_TTL_SECONDS,
      )
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', key, error },
        'Product cache write failed — ignoring',
      )
    }
  }
}
