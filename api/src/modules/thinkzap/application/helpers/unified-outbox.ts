import { env } from '@/config/env'

/**
 * Se a instalação já envia toda origem da linha Z-API pela outbox (e pode ativar o
 * Cadenciador). Ver `env.thinkzapUnifiedOutboxDomains`.
 *
 * `raw` é injetável para teste; em produção vem da env.
 */
export function isUnifiedOutboxEnabled(
  memberId: string | null | undefined,
  raw: string | undefined = env.thinkzapUnifiedOutboxDomains,
): boolean {
  const entries = (raw ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)

  if (entries.includes('*')) return true
  if (!memberId) return false
  return entries.includes(memberId)
}
