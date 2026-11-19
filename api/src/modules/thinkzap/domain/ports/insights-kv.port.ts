/**
 * Armazenamento chave-valor do Insights (resultado dos painéis, estado do
 * cálculo, sessões por dia). Port mínimo: a API e o worker são processos
 * distintos, então o estado compartilhado mora fora da memória (Redis); os
 * testes usam uma versão em memória.
 */
export interface InsightsKv {
  get(key: string): Promise<string | null>
  /** `ttlMs` ausente = sem expiração. */
  set(key: string, value: string, ttlMs?: number): Promise<void>
  del(keys: string[]): Promise<void>
  incr(key: string): Promise<number>
  /** Chaves que casam com o padrão (`*` = qualquer trecho). Nunca bloqueia o Redis. */
  scan(match: string): Promise<string[]>
}
