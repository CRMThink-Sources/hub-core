import type { InsightsKv } from '@/modules/thinkzap/domain/ports/insights-kv.port'
import type { InsightsKeys, InsightsKind } from './insights-keys'

/** Validade do resultado do Desempenho (aba 2). */
export const DASHBOARD_TTL_MS = 5 * 60_000
/** Validade do "Agora" (aba 1): o objetivo é ver o que está aberto neste momento. */
export const TODAY_TTL_MS = 60_000
/**
 * Quanto tempo um resultado vencido ainda pode ser servido enquanto um novo
 * cálculo roda em segundo plano. Além disso o dado é velho demais.
 */
export const STALE_MAX_MS = 30 * 60_000
/**
 * Prazo máximo de um cálculo. Passou disso sem terminar (worker parado, job
 * perdido), a consulta deixa de dizer "calculando" e vira falha: a tela não
 * pode ficar esperando para sempre.
 */
export const MAX_COMPUTE_MS = 15 * 60_000
// Falha fica registrada o suficiente para a próxima consulta contá-la; depois
// disso a abertura seguinte simplesmente calcula de novo.
const FAILED_STATE_TTL_MS = 10 * 60_000

export const TTL_BY_KIND: Record<InsightsKind, number> = {
  dashboard: DASHBOARD_TTL_MS,
  today: TODAY_TTL_MS,
}

export type StoredResult<T> = {
  value: T
  computedAt: number
  /** `true` = dentro da validade; `false` = vencido, mas ainda servível (stale). */
  fresh: boolean
}

export type ComputingState = { status: 'computing'; startedAt: number }
export type CalcState = ComputingState | { status: 'failed'; at: number }

type Envelope = { value: unknown; computedAt: number; ttlMs: number }

/**
 * Resultado dos painéis e estado do cálculo no armazenamento compartilhado. A
 * API lê; o worker grava. O relógio é injetável para o teste não esperar.
 *
 * A **geração** do app é o que faz a invalidação valer entre processos: quem
 * começa um cálculo lê a geração, e só grava o resultado se ela continua a
 * mesma. Salvar a configuração a incrementa, então um cálculo iniciado com a
 * configuração antiga nunca vira resultado guardado.
 */
export class InsightsResultStore {
  private readonly now: () => number

  constructor(
    private readonly deps: {
      kv: InsightsKv
      keys: InsightsKeys
      now?: () => number
    },
  ) {
    this.now = deps.now ?? Date.now
  }

  async getResult<T>(
    appId: string,
    kind: InsightsKind,
    hash: string,
  ): Promise<StoredResult<T> | null> {
    const raw = await this.deps.kv.get(this.deps.keys.result(appId, kind, hash))
    if (raw === null) return null
    let env: Envelope
    try {
      env = JSON.parse(raw) as Envelope
    } catch {
      return null
    }
    const age = this.now() - env.computedAt
    if (age >= env.ttlMs + STALE_MAX_MS) return null
    return {
      value: env.value as T,
      computedAt: env.computedAt,
      fresh: age < env.ttlMs,
    }
  }

  /**
   * Grava o resultado, a menos que o app tenha sido invalidado desde que o
   * cálculo começou (`generation`). Devolve `false` quando descartou.
   */
  async setResult(
    appId: string,
    kind: InsightsKind,
    hash: string,
    value: unknown,
    generation: number,
  ): Promise<boolean> {
    if ((await this.getGeneration(appId)) !== generation) return false
    const ttlMs = TTL_BY_KIND[kind]
    const env: Envelope = { value, computedAt: this.now(), ttlMs }
    await this.deps.kv.set(
      this.deps.keys.result(appId, kind, hash),
      JSON.stringify(env),
      ttlMs + STALE_MAX_MS,
    )
    return true
  }

  async getState(
    appId: string,
    kind: InsightsKind,
    hash: string,
  ): Promise<CalcState | null> {
    const raw = await this.deps.kv.get(this.deps.keys.state(appId, kind, hash))
    if (raw === null) return null
    try {
      return JSON.parse(raw) as CalcState
    } catch {
      return null
    }
  }

  async markComputing(
    appId: string,
    kind: InsightsKind,
    hash: string,
  ): Promise<ComputingState> {
    const state: ComputingState = { status: 'computing', startedAt: this.now() }
    await this.deps.kv.set(
      this.deps.keys.state(appId, kind, hash),
      JSON.stringify(state),
      // Sobra além do prazo máximo: o estado expirar sozinho também é uma
      // saída (o próximo pedido recalcula), mas só depois de a tela já ter
      // sido avisada da falha.
      MAX_COMPUTE_MS + 60_000,
    )
    return state
  }

  async markFailed(
    appId: string,
    kind: InsightsKind,
    hash: string,
  ): Promise<void> {
    const state: CalcState = { status: 'failed', at: this.now() }
    await this.deps.kv.set(
      this.deps.keys.state(appId, kind, hash),
      JSON.stringify(state),
      FAILED_STATE_TTL_MS,
    )
  }

  async clearState(
    appId: string,
    kind: InsightsKind,
    hash: string,
  ): Promise<void> {
    await this.deps.kv.del([this.deps.keys.state(appId, kind, hash)])
  }

  async getGeneration(appId: string): Promise<number> {
    return Number(
      (await this.deps.kv.get(this.deps.keys.generation(appId))) ?? 0,
    )
  }

  /**
   * Salvar a configuração ou trocar a chave muda o resultado de todas as
   * consultas: incrementa a geração (cálculos em andamento deixam de gravar) e
   * apaga resultados, estados e sessões por dia do app.
   */
  async invalidateApp(appId: string): Promise<void> {
    await this.deps.kv.incr(this.deps.keys.generation(appId))
    const found = await Promise.all(
      this.deps.keys
        .invalidationPatterns(appId)
        .map(pattern => this.deps.kv.scan(pattern)),
    )
    await this.deps.kv.del(found.flat())
  }

  /** Marca o app como "usado recentemente", para o pré-aquecimento. */
  async touchLastOpen(appId: string, ttlMs: number): Promise<void> {
    await this.deps.kv.set(
      this.deps.keys.lastOpen(appId),
      String(this.now()),
      ttlMs,
    )
  }

  /** Apps que abriram o Insights dentro da validade do registro. */
  async listRecentlyOpened(): Promise<string[]> {
    const keys = await this.deps.kv.scan(this.deps.keys.lastOpenPattern())
    return keys
      .map(k => this.deps.keys.appIdFromLastOpen(k))
      .filter((id): id is string => id !== null)
  }
}
