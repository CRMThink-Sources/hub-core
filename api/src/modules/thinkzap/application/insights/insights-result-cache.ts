type Entry = { value: unknown; expiresAt: number }

export const DASHBOARD_TTL_MS = 5 * 60_000
export const TODAY_TTL_MS = 60_000

/**
 * Quanto tempo uma entrada expirada ainda pode ser servida enquanto uma recarga
 * roda em segundo plano. Além disso, o dado é velho demais e a carga bloqueia.
 */
export const STALE_MAX_MS = 30 * 60_000

/**
 * Cache em memória dos painéis, por app + consulta. Calcular o painel lê
 * centenas de conversas no Bitrix; sem isso, cada abertura de tela (ou troca
 * de aba) repetiria a leitura inteira e consumiria o limite de chamadas do
 * portal. O relógio é injetável para o teste não depender de espera real.
 *
 * Cargas simultâneas da mesma chave compartilham uma promessa (senão cada aba
 * aberta dispararia a leitura inteira de novo), e entrada recém-expirada é
 * servida na hora enquanto recarrega em segundo plano (stale-while-revalidate),
 * para o usuário não esperar minutos a cada 5 min de TTL.
 */
export class InsightsResultCache {
  private readonly byApp = new Map<string, Map<string, Entry>>()
  private readonly inflight = new Map<string, Map<string, Promise<unknown>>>()
  // Geração por app: invalidate() a incrementa, e uma carga iniciada antes
  // dela não pode gravar o resultado (calculado com a configuração antiga).
  private readonly generation = new Map<string, number>()

  constructor(private readonly now: () => number = Date.now) {}

  async getOrLoad<T>(
    appId: string,
    key: string,
    ttlMs: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const hit = this.byApp.get(appId)?.get(key)
    if (hit) {
      const now = this.now()
      if (hit.expiresAt > now) return hit.value as T
      if (now - hit.expiresAt < STALE_MAX_MS) {
        // Falha da recarga em segundo plano é engolida: a entrada antiga
        // continua servível até STALE_MAX_MS e ninguém está esperando o erro.
        this.loadShared(appId, key, ttlMs, load).catch(() => undefined)
        return hit.value as T
      }
    }
    return this.loadShared(appId, key, ttlMs, load)
  }

  private loadShared<T>(
    appId: string,
    key: string,
    ttlMs: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const running = this.inflight.get(appId)?.get(key)
    if (running) return running as Promise<T>

    const gen = this.generation.get(appId) ?? 0
    const loading = (async () => {
      const value = await load()
      // Invalidada durante a carga: devolve ao chamador, mas não grava.
      if ((this.generation.get(appId) ?? 0) === gen) {
        this.store(appId, key, value, ttlMs)
      }
      return value
    })()
    // Sai também na falha, para o erro não ficar preso no cache. Registrado
    // antes de qualquer outro `await`, então roda antes dos chamadores.
    const release = () => {
      const running = this.inflight.get(appId)
      if (running?.get(key) === loading) {
        running.delete(key)
        if (!running.size) this.inflight.delete(appId)
      }
    }
    loading.then(release, release)
    const map = this.inflight.get(appId) ?? new Map<string, Promise<unknown>>()
    map.set(key, loading)
    this.inflight.set(appId, map)
    return loading
  }

  private store(appId: string, key: string, value: unknown, ttlMs: number) {
    const now = this.now()
    const current = this.byApp.get(appId) ?? new Map<string, Entry>()
    // Só saem as entradas já inservíveis (além da janela stale): período e
    // filtros variam e o mapa cresceria sem limite num processo longo.
    for (const [k, e] of current)
      if (e.expiresAt + STALE_MAX_MS <= now) current.delete(k)
    current.set(key, { value, expiresAt: now + ttlMs })
    this.byApp.set(appId, current)
  }

  /** Chamado ao salvar a configuração: ela muda o resultado de todas as consultas. */
  invalidate(appId: string): void {
    this.generation.set(appId, (this.generation.get(appId) ?? 0) + 1)
    this.inflight.delete(appId)
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
