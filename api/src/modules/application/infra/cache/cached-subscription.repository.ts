import type IORedis from 'ioredis'
import z from 'zod'
import { Subscription } from '@/modules/application/domain/entities/subscription'
import {
  CreateSubscriptionInput,
  SubscriptionRepository,
  UpdateSubscriptionInput,
} from '@/modules/application/domain/repositories/subscription.repository'
import { apiLogger } from '@/shared/infra/logger'
import {
  subscriptionKey,
  subscriptionListKey,
  subscriptionsByAplicationKey,
} from './keys'

const SUBSCRIPTION_TTL_SECONDS = 5 * 60

const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  billingModel: z.string(),
  active: z.boolean(),
})

const aplicationSchema = z.object({
  id: z.string(),
  spaId: z.string().nullable(),
  customer: z.object({
    id: z.string(),
    name: z.string(),
    memberId: z.string(),
  }),
  appCode: z.string(),
  title: z.string(),
  active: z.boolean(),
  // JSON serializa `Date` como string ISO — a leitura precisa reidratar.
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

const subscriptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  plan: z.object({
    id: z.string(),
    name: z.string(),
    product: productSchema,
    amount: z.number().int(),
    interval: z.union([
      z.literal('monthly'),
      z.literal('quarterly'),
      z.literal('semiannual'),
      z.literal('yearly'),
    ]),
    gatewayId: z.string().optional(),
    active: z.boolean(),
  }),
  /**
   * Ampliar esta união rejeita **menos** do que antes, então entrada gravada por
   * um deploy anterior continua satisfazendo o shape — não há miss e não há flush.
   */
  status: z.union([
    z.literal('active'),
    z.literal('past_due'),
    z.literal('cancelled'),
    z.literal('trialing'),
    z.literal('trial_expired'),
  ]),
  // JSON serializa `Date` como string ISO — a leitura precisa reidratar.
  currentPeriodStart: z.coerce.date(),
  currentPeriodEnd: z.coerce.date(),
  aplication: aplicationSchema,
  // Sem `product` na raiz: o produto cobrado é o de `plan.product`.
  gatewayId: z.string().optional(),
  /**
   * Obrigatória aqui, apesar de tolerante na leitura da SPA: a entidade sempre a
   * resolve antes de virar cache, então entrada sem o campo é de um deploy
   * anterior e tem que virar miss.
   */
  modality: z.union([z.literal('stripe'), z.literal('manual')]),
})

const subscriptionListSchema = z.array(subscriptionSchema)

/** Entrada corrompida no Redis não pode derrubar a request — vira miss. */
function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Decorator de cache sobre qualquer `SubscriptionRepository`.
 * Não conhece a origem dos dados — falha de Redis nunca derruba a operação.
 *
 * Diferente de produto e plano, a escrita **invalida** as chaves afetadas:
 * assinatura que a própria aplicação acabou de cancelar não pode continuar
 * `active` por 5 min na mesma aplicação.
 *
 * A chave de listagem é por **aplicação** (o `spaId` do item espelho), porque é
 * por ela que a SPA filtra — a visão por cliente é derivada em
 * `CustomerRepository.getCustomerProducts`.
 */
export class CachedSubscriptionRepository implements SubscriptionRepository {
  constructor(
    private readonly inner: SubscriptionRepository,
    private readonly redis: IORedis,
  ) {}

  async getSubscription(id: string): Promise<Subscription> {
    const cached = await this.read(subscriptionKey(id), subscriptionSchema)
    if (cached) return cached

    const subscription = await this.inner.getSubscription(id)
    await this.write(subscriptionKey(id), subscription)

    return subscription
  }

  async getSubscriptions(): Promise<Subscription[]> {
    const cached = await this.read(
      subscriptionListKey(),
      subscriptionListSchema,
    )
    if (cached) return cached

    const subscriptions = await this.inner.getSubscriptions()
    await this.write(subscriptionListKey(), subscriptions)

    return subscriptions
  }

  async getSubscriptionsByAplication(
    aplicationSpaId: string,
  ): Promise<Subscription[]> {
    const key = subscriptionsByAplicationKey(aplicationSpaId)

    const cached = await this.read(key, subscriptionListSchema)
    if (cached) return cached

    const subscriptions =
      await this.inner.getSubscriptionsByAplication(aplicationSpaId)
    await this.write(key, subscriptions)

    return subscriptions
  }

  /**
   * **Sem cache, de propósito.** É a busca de idempotência do webhook, chamada
   * poucas vezes por contratação e sempre para decidir uma escrita. Uma entrada
   * velha aqui faria uma reentrega ver estado antigo e reprocessar — e cachear
   * exigiria invalidar mais uma chave em cada escrita, para ganhar nada num
   * caminho que não é quente.
   *
   * Sem chave também significa **sem `CACHE_VERSION` a subir** quando a leitura
   * passou de uma assinatura para o conjunto: a entidade `Subscription` não mudou
   * de shape, e nada gravado por deploy anterior descreve este método.
   */
  async listSubscriptionsByGatewayId(
    gatewayId: string,
  ): Promise<Subscription[]> {
    return this.inner.listSubscriptionsByGatewayId(gatewayId)
  }

  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<Subscription> {
    const subscription = await this.inner.createSubscription(input)
    await this.refresh(subscription)

    return subscription
  }

  async updateSubscription(
    id: string,
    patch: UpdateSubscriptionInput,
  ): Promise<Subscription> {
    const subscription = await this.inner.updateSubscription(id, patch)
    await this.refresh(subscription)

    return subscription
  }

  /**
   * Invalida as chaves afetadas e regrava a individual (write-through).
   * A aplicação sai da **entidade devolvida**, não do patch, então a chave de
   * listagem certa é invalidada mesmo num update que não mencionou a aplicação.
   *
   * Aplicação sem espelho (`spaId` nulo) não tem chave de listagem: o filtro da
   * SPA depende do `spaId`, então nunca houve o que cachear ali.
   *
   * A escrita no Bitrix já aconteceu e é a fonte da verdade: falha de Redis aqui
   * é logada e engolida — derrubar a operação trocaria uma inconsistência de
   * 5 min por uma falha de escrita.
   */
  private async refresh(subscription: Subscription): Promise<void> {
    const key = subscriptionKey(subscription.id)
    const { spaId } = subscription.aplication

    try {
      await this.redis.del(
        key,
        subscriptionListKey(),
        ...(spaId ? [subscriptionsByAplicationKey(spaId)] : []),
      )
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', key, error },
        'Subscription cache invalidation failed — ignoring',
      )
    }

    await this.write(key, subscription)
  }

  /** Miss, falha de Redis e entrada com shape velho são todos tratados como miss. */
  private async read<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
    let hit: string | null
    try {
      hit = await this.redis.get(key)
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', key, error },
        'Subscription cache read failed — falling back to source',
      )
      return null
    }

    if (!hit) return null

    const parsed = schema.safeParse(safeJsonParse(hit))
    if (!parsed.success) {
      apiLogger.warn(
        { app: 'payments', key, issues: parsed.error.issues },
        'Subscription cache entry has stale shape — discarding',
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
        SUBSCRIPTION_TTL_SECONDS,
      )
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', key, error },
        'Subscription cache write failed — ignoring',
      )
    }
  }
}
