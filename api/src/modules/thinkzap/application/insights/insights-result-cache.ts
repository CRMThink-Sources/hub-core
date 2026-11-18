type Entry = { value: unknown; expiresAt: number }

export const DASHBOARD_TTL_MS = 5 * 60_000
export const TODAY_TTL_MS = 60_000

/**
 * Cache em memória dos painéis, por app + consulta. Calcular o painel lê
 * centenas de conversas no Bitrix; sem isso, cada abertura de tela (ou troca
 * de aba) repetiria a leitura inteira e consumiria o limite de chamadas do
 * portal. O relógio é injetável para o teste não depender de espera real.
 */
export class InsightsResultCache {
  private readonly byApp = new Map<string, Map<string, Entry>>()

  constructor(private readonly now: () => number = Date.now) {}

  async getOrLoad<T>(
    appId: string,
    key: string,
    ttlMs: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const entries = this.byApp.get(appId)
    const hit = entries?.get(key)
    if (hit && hit.expiresAt > this.now()) return hit.value as T

    const value = await load()
    const now = this.now()
    const current = this.byApp.get(appId) ?? new Map<string, Entry>()
    // Expirados saem na escrita: período e filtros variam e o mapa cresceria
    // sem limite num processo de longa duração.
    for (const [k, e] of current) if (e.expiresAt <= now) current.delete(k)
    current.set(key, { value, expiresAt: now + ttlMs })
    this.byApp.set(appId, current)
    return value
  }

  /** Chamado ao salvar a configuração: ela muda o resultado de todas as consultas. */
  invalidate(appId: string): void {
    this.byApp.delete(appId)
  }
}

export const insightsResultCache = new InsightsResultCache()

export const invalidateInsightsCache = (appId: string): void =>
  insightsResultCache.invalidate(appId)

/** Chave estável: a ordem das chaves da query não pode gerar entradas distintas. */
export const insightsCacheKey = (
  kind: 'dashboard' | 'today',
  q: Record<string, unknown>,
): string =>
  `${kind}:${JSON.stringify(
    Object.entries(q)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  )}`
