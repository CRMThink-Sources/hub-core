import type { InsightsKv } from '@/modules/thinkzap/domain/ports/insights-kv.port'
import { MemoryInsightsKv } from '@/modules/thinkzap/infra/insights/memory-insights-kv'
import { makeInsightsKeys, type InsightsKeys } from './insights-keys'

/**
 * Estado do problema da chave Vibecode por instalação. É um aviso transitório
 * (ex.: a Vibecode recusou a chave numa consulta), não um dado a persistir no
 * banco: vive no armazenamento compartilhado (Redis) para a API e o worker de
 * cálculo enxergarem o mesmo estado — quem marca é o worker, quem mostra ao
 * admin é a API —, mas **expira sozinho**, como antes o reinício do processo o
 * apagava. Ao regravar ou remover a chave ele é limpo, e uma nova recusa o
 * marca de novo.
 */
export type KeyProblem = 'revoked' | 'unreadable'

// Sem isso uma recusa passageira deixaria o app no REST clássico para sempre.
const KEY_PROBLEM_TTL_MS = 6 * 3600e3

// Padrão em memória: testes e qualquer processo que não configurou o Redis.
// A composição da API e o worker chamam `configureKeyHealth` com o Redis.
let kv: InsightsKv = new MemoryInsightsKv()
let keys: InsightsKeys = makeInsightsKeys('bull')

export function configureKeyHealth(deps: {
  kv: InsightsKv
  keys: InsightsKeys
}): void {
  kv = deps.kv
  keys = deps.keys
}

export async function markKeyRevoked(appId: string): Promise<void> {
  await kv.set(keys.keyProblem(appId), 'revoked', KEY_PROBLEM_TTL_MS)
}

/**
 * A chave guardada não pôde ser decifrada (texto corrompido ou
 * TOKEN_ENCRYPTION_KEY trocada). Sem isso o app serviria o clássico em
 * silêncio e o admin nunca saberia que precisa cadastrar a chave de novo.
 */
export async function markKeyUnreadable(appId: string): Promise<void> {
  await kv.set(keys.keyProblem(appId), 'unreadable', KEY_PROBLEM_TTL_MS)
}

export async function clearKeyProblem(appId: string): Promise<void> {
  await kv.del([keys.keyProblem(appId)])
}

export async function getKeyProblem(appId: string): Promise<KeyProblem | null> {
  const v = await kv.get(keys.keyProblem(appId))
  return v === 'revoked' || v === 'unreadable' ? v : null
}
