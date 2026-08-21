import type IORedis from 'ioredis'

import { PlanPrice } from '@/modules/application/domain/entities/plan-price'
import { PlanPriceReader } from '@/modules/application/domain/repositories/plan-price.reader'
import { apiLogger } from '@/shared/infra/logger'
import { planPriceKey } from './keys'
import { planPriceSchema } from './plan-price.schema'

/**
 * TTL maior que o do catálogo (5 min): preço no gateway muda por ação humana no
 * painel do Stripe, não por operação do produto. O que fica velho aqui é o número
 * exibido, e uma hora é o intervalo em que uma mudança de tabela de preço aparece —
 * a cobrança em si já sai correta, porque quem aplica os degraus é o gateway.
 */
const PLAN_PRICE_TTL_SECONDS = 60 * 60

/**
 * Cache de leitura do preço, por price id.
 *
 * **Cache próprio, e não campo dentro do plano cacheado**, por duas razões que
 * apareceram implementando. A primeira: se o preço morasse no `PlanRepository`, o
 * repositório de plano passaria a depender do gateway — e o repositório de plano é
 * lido pelo contexto da instalação, que o worker de mensagem usa. O guard
 * `runtime-gateway-isolation` reprova isso, e com razão: seria latência de terceiro em
 * cada mensagem recebida. A segunda: invalidar o catálogo (webhook da SPA, edição de
 * plano no CRM) descartaria o preço junto, sem necessidade — o price no gateway não
 * mudou porque alguém editou o título do plano no Bitrix.
 *
 * Falha de Redis nunca derruba a leitura, como nos outros decoradores daqui: vira
 * miss, com `warn`.
 */
export class CachedPlanPriceReader implements PlanPriceReader {
  constructor(
    private readonly inner: PlanPriceReader,
    private readonly redis: IORedis,
  ) {}

  async readPrice(priceId: string): Promise<PlanPrice> {
    const key = planPriceKey(priceId)

    const cached = await this.read(key)
    if (cached) return cached

    const price = await this.inner.readPrice(priceId)
    await this.write(key, price)

    return price
  }

  private async read(key: string): Promise<PlanPrice | null> {
    let hit: string | null
    try {
      hit = await this.redis.get(key)
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', key, error },
        'Plan price cache read failed — falling back to gateway',
      )
      return null
    }

    if (!hit) return null

    let parsed: unknown
    try {
      parsed = JSON.parse(hit)
    } catch {
      return null
    }

    const result = planPriceSchema.safeParse(parsed)
    if (!result.success) {
      apiLogger.warn(
        { app: 'payments', key },
        'Plan price cache entry has stale shape — treating as miss',
      )
      return null
    }

    return result.data
  }

  private async write(key: string, price: PlanPrice): Promise<void> {
    try {
      await this.redis.set(
        key,
        JSON.stringify(price),
        'EX',
        PLAN_PRICE_TTL_SECONDS,
      )
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', key, error },
        'Plan price cache write failed — ignoring',
      )
    }
  }
}
