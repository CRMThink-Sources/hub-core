import {
  type BitrixLimits,
  type BitrixLimitsContext,
} from './bitrix-limits.port'
import {
  type BucketLimits,
  type BucketState,
  DEFAULT_BUCKET_LIMITS,
  emptyBucket,
  reserve,
} from './leaky-bucket'
import {
  OPERATING_LIMIT_SECONDS,
  OPERATING_WARN_RATIO,
} from './operating-budget'

/**
 * Mesmo controle, estado em memória.
 *
 * Serve dois casos: processo único em dev sem Redis, e teste — que precisa observar a
 * decisão sem subir infra. Em produção com mais de um processo é **errado**, porque
 * cada um acharia que tem o balde inteiro; é a `RedisBitrixLimits` que vale ali.
 *
 * O script Lua da versão Redis espelha a aritmética de `reserve`. Esta classe é o que
 * mantém essa aritmética exercitada por teste.
 */
export class InMemoryBitrixLimits implements BitrixLimits {
  private readonly buckets = new Map<string, BucketState>()
  private readonly paused = new Map<string, number>()

  constructor(
    private readonly limits: BucketLimits = DEFAULT_BUCKET_LIMITS,
    private readonly now: () => number = Date.now,
    /** Injetável para o teste não esperar de verdade. */
    private readonly sleep: (ms: number) => Promise<void> = ms =>
      new Promise(resolve => setTimeout(resolve, ms)),
  ) {}

  async acquire(context: BitrixLimitsContext): Promise<void> {
    const nowMs = this.now()
    const state = this.buckets.get(context.domain) ?? emptyBucket(nowMs)
    const decision = reserve(state, nowMs, this.limits)

    this.buckets.set(context.domain, decision.state)

    if (decision.waitMs > 0) await this.sleep(decision.waitMs)
  }

  pausedUntil(context: BitrixLimitsContext): Promise<number | null> {
    const untilMs = this.paused.get(this.key(context))
    if (!untilMs) return Promise.resolve(null)

    if (untilMs <= this.now()) {
      this.paused.delete(this.key(context))
      return Promise.resolve(null)
    }

    return Promise.resolve(untilMs)
  }

  async observeOperating(
    context: BitrixLimitsContext,
    operatingSeconds: number,
    resetAtMs: number | null,
  ): Promise<void> {
    if (operatingSeconds / OPERATING_LIMIT_SECONDS < OPERATING_WARN_RATIO)
      return

    const nowMs = this.now()
    await this.pauseMethod(
      context,
      resetAtMs && resetAtMs > nowMs ? resetAtMs : nowMs + 60_000,
    )
  }

  pauseMethod(context: BitrixLimitsContext, untilMs: number): Promise<void> {
    this.paused.set(this.key(context), untilMs)
    return Promise.resolve()
  }

  private key(context: BitrixLimitsContext): string {
    return `${context.domain}:${context.method}`
  }
}
