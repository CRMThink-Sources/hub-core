import type IORedis from 'ioredis'
import z from 'zod'
import {
  SubscriptionStatusCounter,
  SubscriptionStatusCounts,
} from '@/modules/application/domain/repositories/subscription-status.counter'
import { apiLogger } from '@/shared/infra/logger'

/**
 * Um minuto: é número de painel, e a SPA não invalida esta chave pelo webhook — de
 * propósito, para não alargar o raio do `invalidate-spa-cache` por um indicador.
 */
export const SUBSCRIPTION_STATUS_COUNTS_TTL_SECONDS = 60

export const subscriptionStatusCountsKey = () =>
  'dashboard:subscription-status-counts:v1'

const countsSchema = z.object({
  active: z.number().int(),
  pastDue: z.number().int(),
  trialing: z.number().int(),
  // JSON serializa `Date` como string ISO — a leitura precisa reidratar.
  countedAt: z.coerce.date(),
})

/**
 * Cache curto da contagem por status, compartilhado entre quem abre a home. Falha
 * da contagem não é cacheada: o próximo pedido tenta o Bitrix de novo. Falha do
 * Redis vira miss — o painel fica mais lento, não quebrado.
 */
export class CachedSubscriptionStatusCounter implements SubscriptionStatusCounter {
  constructor(
    private readonly inner: SubscriptionStatusCounter,
    private readonly redis: IORedis,
  ) {}

  async count(): Promise<SubscriptionStatusCounts> {
    const cached = await this.read()
    if (cached) return cached

    const counts = await this.inner.count()
    await this.write(counts)
    return counts
  }

  private async read(): Promise<SubscriptionStatusCounts | null> {
    try {
      const hit = await this.redis.get(subscriptionStatusCountsKey())
      if (!hit) return null
      const parsed = countsSchema.safeParse(JSON.parse(hit))
      return parsed.success ? parsed.data : null
    } catch (error) {
      apiLogger.warn(
        { app: 'shared', err: error },
        'Cache da contagem de assinaturas ilegível ou indisponível — lendo do Bitrix',
      )
      return null
    }
  }

  private async write(counts: SubscriptionStatusCounts): Promise<void> {
    try {
      await this.redis.set(
        subscriptionStatusCountsKey(),
        JSON.stringify(counts),
        'EX',
        SUBSCRIPTION_STATUS_COUNTS_TTL_SECONDS,
      )
    } catch (error) {
      apiLogger.warn(
        { app: 'shared', err: error },
        'Falha ao gravar o cache da contagem de assinaturas',
      )
    }
  }
}
