import type IORedis from 'ioredis'
import z from 'zod'
import { Plan } from '@/modules/application/domain/entities/plan'
import { PlanRepository } from '@/modules/application/domain/repositories/get-plan.repository'
import { apiLogger } from '@/shared/infra/logger'
import { planKey, planListKey } from './keys'
import { loadWithStaleFallback, writeStale } from './stale-if-error'

const PLAN_TTL_SECONDS = 5 * 60

const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  product: z.object({
    id: z.string(),
    name: z.string(),
    billingModel: z.string(),
    active: z.boolean(),
  }),
  amount: z.number().int(),
  interval: z.union([
    z.literal('monthly'),
    z.literal('quarterly'),
    z.literal('semiannual'),
    z.literal('yearly'),
  ]),
  gatewayId: z.string().optional(),
  provider: z.union([z.literal('ZAPI'), z.literal('HUBMESSAGE')]).optional(),
  active: z.boolean(),
})

const planListSchema = z.array(planSchema)

/** Entrada corrompida no Redis não pode derrubar a request — vira miss. */
function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Decorator de cache sobre qualquer `PlanRepository`.
 * Não conhece a origem dos dados — falha de Redis nunca derruba a leitura.
 */
export class CachedPlanRepository implements PlanRepository {
  constructor(
    private readonly inner: PlanRepository,
    private readonly redis: IORedis,
  ) {}

  async getPlan(id: string): Promise<Plan> {
    const cachedPlan = await this.read(planKey(id), planSchema)
    if (cachedPlan) return cachedPlan

    const { value: plan, stale } = await loadWithStaleFallback({
      redis: this.redis,
      key: planKey(id),
      schema: planSchema,
      family: 'Plan',
      load: () => this.inner.getPlan(id),
    })
    if (!stale) await this.write(planKey(id), plan)

    return plan
  }

  async getPlans(): Promise<Plan[]> {
    const cachedPlans = await this.read(planListKey(), planListSchema)
    if (cachedPlans) return cachedPlans

    const { value: plans, stale } = await loadWithStaleFallback({
      redis: this.redis,
      key: planListKey(),
      schema: planListSchema,
      family: 'Plan',
      load: () => this.inner.getPlans(),
    })
    if (!stale) await this.write(planListKey(), plans)

    return plans
  }

  /** Miss, falha de Redis e entrada com shape velho são todos tratados como miss. */
  private async read<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
    let hit: string | null
    try {
      hit = await this.redis.get(key)
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', key, error },
        'Plan cache read failed — falling back to source',
      )
      return null
    }

    if (!hit) return null

    const parsed = schema.safeParse(safeJsonParse(hit))
    if (!parsed.success) {
      apiLogger.warn(
        { app: 'payments', key, issues: parsed.error.issues },
        'Plan cache entry has stale shape — discarding',
      )
      return null
    }

    return parsed.data
  }

  /** Grava a fresca (TTL curto) e a reserva de 24 h usada só se o Bitrix falhar. */
  private async write(key: string, value: unknown): Promise<void> {
    await writeStale(this.redis, key, value)
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', PLAN_TTL_SECONDS)
    } catch (error) {
      apiLogger.warn(
        { app: 'payments', key, error },
        'Plan cache write failed — ignoring',
      )
    }
  }
}
