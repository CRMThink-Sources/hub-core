import type IORedis from 'ioredis'
import z from 'zod'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import {
  CreateSubscriptionItemInput,
  SubscriptionItemRepository,
  UpdateSubscriptionItemInput,
} from '@/modules/application/domain/repositories/subscription-item.repository'
import { apiLogger } from '@/shared/infra/logger'

const SUBSCRIPTION_ITEM_TTL_SECONDS = 5 * 60

/**
 * Versão do shape do `SubscriptionItem`. Sobe junto com qualquer mudança na
 * entidade, para que entradas gravadas por um deploy anterior sejam ignoradas.
 *
 * Diferente de assinatura, **não** depende do shape de `Plan`, `Product` nem
 * `Aplication`: o item não aninha nenhuma outra entidade — `subscription` é o id
 * do pai. Mudança em plano ou produto não invalida cache de item.
 *
 * `v2`: `settings` entrou na entidade. `v3`: `vinculatedChannel` também. Subir a
 * versão torna o descarte de entradas antigas determinístico, em vez de depender de
 * o schema reprová-las.
 */
const CACHE_VERSION = 'v3'

const metadataSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('ZAPI'),
    zApiInstanceId: z.string(),
    zApiInstanceToken: z.string(),
  }),
  z.object({
    provider: z.literal('HUBMESSAGE'),
    hubmessageChannelId: z.string(),
    wabaId: z.string(),
  }),
  z.object({ provider: z.literal('NONE') }),
])

/**
 * Os quatro toggles são obrigatórios aqui, apesar de opcionais no schema de
 * domínio: a entidade sempre os resolve antes de virar cache, então uma entrada
 * sem eles é de um deploy anterior e tem que virar miss.
 */
const settingsSchema = z.object({
  prefixOperatorNameEnabled: z.boolean(),
  messageUpdateEventEnabled: z.boolean(),
  messageDeleteEventEnabled: z.boolean(),
  widgetOpenChannelEnabled: z.boolean(),
})

const subscriptionItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  subscription: z.string(),
  status: z.union([z.literal('active'), z.literal('cancelled')]),
  metadata: metadataSchema,
  settings: settingsSchema,
  vinculatedChannel: z.string().nullable(),
  gatewayId: z.string().optional(),
})

const subscriptionItemListSchema = z.array(subscriptionItemSchema)

/** Entrada corrompida no Redis não pode derrubar a request — vira miss. */
function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const itemKey = (id: string) =>
  `payments:subscription-item:${CACHE_VERSION}:${id}`
const itemListKey = () => `payments:subscription-items:${CACHE_VERSION}:all`
const subscriptionListKey = (subscriptionId: string) =>
  `payments:subscription-items:${CACHE_VERSION}:subscription:${subscriptionId}`

/**
 * Decorator de cache sobre qualquer `SubscriptionItemRepository`.
 * Não conhece a origem dos dados — falha de Redis nunca derruba a operação.
 *
 * Como em assinatura, a escrita **invalida** as chaves afetadas: item que a
 * própria aplicação acabou de cancelar não pode continuar `active` por 5 min.
 */
export class CachedSubscriptionItemRepository implements SubscriptionItemRepository {
  constructor(
    private readonly inner: SubscriptionItemRepository,
    private readonly redis: IORedis,
  ) {}

  async getSubscriptionItem(id: string): Promise<SubscriptionItem> {
    const cached = await this.read(itemKey(id), subscriptionItemSchema)
    if (cached) return cached

    const item = await this.inner.getSubscriptionItem(id)
    await this.write(itemKey(id), item)

    return item
  }

  async getSubscriptionItems(): Promise<SubscriptionItem[]> {
    const cached = await this.read(itemListKey(), subscriptionItemListSchema)
    if (cached) return cached

    const items = await this.inner.getSubscriptionItems()
    await this.write(itemListKey(), items)

    return items
  }

  async getSubscriptionItemsBySubscription(
    subscriptionId: string,
  ): Promise<SubscriptionItem[]> {
    const key = subscriptionListKey(subscriptionId)

    const cached = await this.read(key, subscriptionItemListSchema)
    if (cached) return cached

    const items =
      await this.inner.getSubscriptionItemsBySubscription(subscriptionId)
    await this.write(key, items)

    return items
  }

  async createSubscriptionItem(
    input: CreateSubscriptionItemInput,
  ): Promise<SubscriptionItem> {
    const item = await this.inner.createSubscriptionItem(input)
    await this.refresh(item)

    return item
  }

  async updateSubscriptionItem(
    id: string,
    patch: UpdateSubscriptionItemInput,
  ): Promise<SubscriptionItem> {
    const item = await this.inner.updateSubscriptionItem(id, patch)
    await this.refresh(item)

    return item
  }

  /**
   * Invalida as três chaves afetadas e regrava a individual (write-through).
   * A assinatura sai da **entidade devolvida**, não do patch — que aliás nem
   * aceita `subscription` — então a chave de listagem certa é invalidada mesmo
   * num update que só mexeu no status.
   *
   * A escrita no Bitrix já aconteceu e é a fonte da verdade: falha de Redis aqui
   * é logada e engolida — derrubar a operação trocaria uma inconsistência de
   * 5 min por uma falha de escrita.
   */
  private async refresh(item: SubscriptionItem): Promise<void> {
    const key = itemKey(item.id)

    try {
      await this.redis.del(
        key,
        itemListKey(),
        subscriptionListKey(item.subscription),
      )
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', key, error },
        'Subscription item cache invalidation failed — ignoring',
      )
    }

    await this.write(key, item)
  }

  /** Miss, falha de Redis e entrada com shape velho são todos tratados como miss. */
  private async read<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
    let hit: string | null
    try {
      hit = await this.redis.get(key)
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', key, error },
        'Subscription item cache read failed — falling back to source',
      )
      return null
    }

    if (!hit) return null

    const parsed = schema.safeParse(safeJsonParse(hit))
    if (!parsed.success) {
      apiLogger.warn(
        { app: 'payments', key, issues: parsed.error.issues },
        'Subscription item cache entry has stale shape — discarding',
      )
      return null
    }

    return parsed.data
  }

  private async write(key: string, value: unknown): Promise<void> {
    try {
      await this.redis.set(
        key,
        JSON.stringify(value),
        'EX',
        SUBSCRIPTION_ITEM_TTL_SECONDS,
      )
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', key, error },
        'Subscription item cache write failed — ignoring',
      )
    }
  }
}
