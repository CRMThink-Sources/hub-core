import type { InsightsSession } from '@/modules/thinkzap/application/insights/metrics/types'
import type { InsightsKeys } from '@/modules/thinkzap/application/insights/insights-keys'
import type { InsightsKv } from '@/modules/thinkzap/domain/ports/insights-kv.port'

/**
 * Sessões de um dia de Brasília já lidas e enriquecidas, guardadas fora da
 * memória do processo. É o que faz um dia fechado ser lido uma vez só, mesmo
 * entre deploys e entre a API e o worker.
 */
export interface SessionDayCache {
  /** `null` = o dia não está guardado (ou a leitura falhou: vale como ausente). */
  read(day: string): Promise<InsightsSession[] | null>
  /**
   * Grava o dia, a menos que o app tenha sido invalidado desde que a leitura
   * começou (`generation`). Devolve `false` quando descartou.
   */
  write(
    day: string,
    sessions: InsightsSession[],
    ttlMs: number,
    generation: number,
  ): Promise<boolean>
  generation(): Promise<number>
}

/** `SessionDayCache` de um app sobre o `InsightsKv`. */
export class KvSessionDayCache implements SessionDayCache {
  constructor(
    private readonly kv: InsightsKv,
    private readonly keys: InsightsKeys,
    private readonly appId: string,
  ) {}

  async read(day: string): Promise<InsightsSession[] | null> {
    const raw = await this.kv.get(this.keys.day(this.appId, day))
    if (raw === null) return null
    try {
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as InsightsSession[]) : null
    } catch {
      // Valor corrompido não pode derrubar o painel: relê o dia.
      return null
    }
  }

  async write(
    day: string,
    sessions: InsightsSession[],
    ttlMs: number,
    generation: number,
  ): Promise<boolean> {
    if ((await this.generation()) !== generation) return false
    await this.kv.set(
      this.keys.day(this.appId, day),
      JSON.stringify(sessions),
      ttlMs,
    )
    return true
  }

  async generation(): Promise<number> {
    return Number((await this.kv.get(this.keys.generation(this.appId))) ?? 0)
  }
}
