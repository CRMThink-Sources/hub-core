import type IORedis from 'ioredis'
import z from 'zod'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import {
  CreateSubscriptionItemInput,
  SubscriptionItemRepository,
  UpdateSubscriptionItemInput,
} from '@/modules/application/domain/repositories/subscription-item.repository'
import { apiLogger } from '@/shared/infra/logger'
import {
  subscriptionItemKey,
  subscriptionItemListKey,
  subscriptionItemsBySubscriptionKey,
} from './keys'
import { loadWithStaleFallback, writeStale } from './stale-if-error'

const SUBSCRIPTION_ITEM_TTL_SECONDS = 5 * 60

const metadataSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('ZAPI'),
    zApiInstanceId: z.string(),
    zApiInstanceToken: z.string(),
  }),
  z.object({
    provider: z.literal('HUBMESSAGE'),
    hubmessageChannelId: z.string(),
    /** Ausente até o canal ser conectado na Meta — ver a entidade. */
    wabaId: z.string().optional(),
  }),
  z.object({ provider: z.literal('NONE') }),
])

/**
 * Os campos são obrigatórios aqui, apesar de opcionais no schema de
 * domínio: a entidade sempre os resolve antes de virar cache, então uma entrada
 * sem eles é de um deploy anterior e tem que virar miss.
 */
const settingsSchema = z.object({
  prefixOperatorNameEnabled: z.boolean(),
  widgetOpenChannelEnabled: z.boolean(),
  dailyLimitEnabled: z.boolean(),
  dailyLimit: z.number().nullable(),
  deviceMessageMirrorEnabled: z.boolean(),
  cadenceEnabled: z.boolean(),
  cadenceMaxMessages: z.number().nullable(),
  cadenceWindowMinutes: z.number().nullable(),
  cadencePauseEnabled: z.boolean(),
  cadencePauseMinutes: z.number().nullable(),
  cadenceCountDeviceMessages: z.boolean(),
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
  /**
   * Opcional: entrada gravada antes do campo existir não vira miss, só sai sem ele
   * (o mapper da view trata ausência como `null`). Sem a chave aqui, o `z.object`
   * a descartaria em todo hit, e a lista de conexões mostraria "sem registro" para
   * linha conectada durante o TTL.
   */
  connected: z.boolean().nullable().optional(),
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
    const cached = await this.read(
      subscriptionItemKey(id),
      subscriptionItemSchema,
    )
    if (cached) return cached

    const { value: item, stale } = await loadWithStaleFallback({
      redis: this.redis,
      key: subscriptionItemKey(id),
      schema: subscriptionItemSchema,
      family: 'Subscription item',
      load: () => this.inner.getSubscriptionItem(id),
    })
    if (!stale) await this.write(subscriptionItemKey(id), item)

    return item
  }

  async getSubscriptionItems(): Promise<SubscriptionItem[]> {
    const cached = await this.read(
      subscriptionItemListKey(),
      subscriptionItemListSchema,
    )
    if (cached) return cached

    const { value: items, stale } = await loadWithStaleFallback({
      redis: this.redis,
      key: subscriptionItemListKey(),
      schema: subscriptionItemListSchema,
      family: 'Subscription item',
      load: () => this.inner.getSubscriptionItems(),
    })
    if (!stale) await this.write(subscriptionItemListKey(), items)

    return items
  }

  async getSubscriptionItemsBySubscription(
    subscriptionId: string,
  ): Promise<SubscriptionItem[]> {
    const key = subscriptionItemsBySubscriptionKey(subscriptionId)

    const cached = await this.read(key, subscriptionItemListSchema)
    if (cached) return cached

    const { value: items, stale } = await loadWithStaleFallback({
      redis: this.redis,
      key: key,
      schema: subscriptionItemListSchema,
      family: 'Subscription item',
      load: () => this.inner.getSubscriptionItemsBySubscription(subscriptionId),
    })
    if (!stale) await this.write(key, items)

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

  async reparentSubscriptionItem(
    itemId: string,
    subscriptionId: string,
  ): Promise<SubscriptionItem> {
    /**
     * Origem lida do **interno**, não do cache: é a chave de listagem que precisa
     * ser invalidada, e uma entrada velha apontaria para a assinatura errada —
     * deixando o item aparecendo numa listagem que ele já não pertence, sem nada
     * para corrigir isso antes do TTL.
     */
    const origin = (await this.inner.getSubscriptionItem(itemId)).subscription

    const item = await this.inner.reparentSubscriptionItem(
      itemId,
      subscriptionId,
    )

    await this.refresh(item, origin)

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
   *
   * @param originSubscriptionId Só no repai: a assinatura de **onde** o item
   * saiu. Invalidar apenas a de destino deixaria o item aparecendo na listagem da
   * origem até o TTL — duas assinaturas mostrando a mesma linha.
   */
  private async refresh(
    item: SubscriptionItem,
    originSubscriptionId?: string,
  ): Promise<void> {
    const key = subscriptionItemKey(item.id)

    const originKeys =
      originSubscriptionId && originSubscriptionId !== item.subscription
        ? [subscriptionItemsBySubscriptionKey(originSubscriptionId)]
        : []

    try {
      await this.redis.del(
        key,
        subscriptionItemListKey(),
        subscriptionItemsBySubscriptionKey(item.subscription),
        ...originKeys,
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

  /** Grava a fresca (TTL curto) e a reserva de 24 h usada só se o Bitrix falhar. */
  private async write(key: string, value: unknown): Promise<void> {
    await writeStale(this.redis, key, value)
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
