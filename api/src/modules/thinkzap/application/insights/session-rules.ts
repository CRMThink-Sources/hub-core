import type { InsightsConfig } from '@/modules/thinkzap/domain/insights-config'
import { businessSeconds } from './metrics/business-seconds'
import type { InsightsSession } from './metrics/types'
import { finite } from './insights-stats'

export type SessionRules = ReturnType<typeof makeSessionRules>

const OPEN_STATUSES = ['new', 'answered', 'paused']
export const isOpenStatus = (status: string) => OPEN_STATUSES.includes(status)

/**
 * Conector conta para o painel? Lista explícita (da query ou da configuração)
 * manda; sem lista, só os conectores do ThinkZap. O original ainda tinha
 * `ALL_SOURCES=1` por variável de ambiente, só para validar com o WhatsApp
 * nativo — aqui quem precisar disso configura `sources`.
 */
export function isThinkZap(
  s: Pick<InsightsSession, 'source'>,
  querySources: string[],
  cfg: Pick<InsightsConfig, 'sources'>,
): boolean {
  const list = querySources.length ? querySources : cfg.sources
  return list.length
    ? list.includes(s.source)
    : s.source.startsWith('hubthink_thinkzap')
}

/**
 * Regras por conversa do original (fa, takeover, openSec, stuck, answered,
 * lost), com a configuração, a fonte e o "agora" fixados por parâmetro em vez
 * de lidos de estado global.
 */
export function makeSessionRules(
  cfg: InsightsConfig,
  mode: 'full' | 'lean',
  now: Date,
) {
  // A espera gravada pelo Bitrix (Vibe) conta do início da sessão; a calculada
  // pelo histórico (REST clássico) conta da 1ª mensagem do cliente.
  const waitStart = (s: InsightsSession) =>
    mode === 'lean' ? s.firstClientAt || s.dateCreate : s.dateCreate

  // Conversa iniciada pela empresa: a 1ª mensagem é nossa, então não existe
  // "tempo de 1ª resposta" ao cliente.
  const computeFa = (s: InsightsSession): number | null => {
    const wait = finite(s.waitAnswer)
    if (s.initiatedBy === 'company' || wait == null) return null
    if (!cfg.bizOnly) return wait
    const a = waitStart(s)
    return finite(
      businessSeconds(a, new Date(new Date(a).getTime() + wait * 1000), cfg),
    )
  }
  // `fa` é chamado várias vezes por conversa e o horário comercial percorre
  // dia a dia; o memo vive só nesta chamada do painel.
  const faMemo = new Map<InsightsSession, number | null>()
  const fa = (s: InsightsSession): number | null => {
    if (!faMemo.has(s)) faMemo.set(s, computeFa(s))
    return faMemo.get(s) ?? null
  }

  // Tempo até uma pessoa assumir a conversa (o robô pode ter respondido antes).
  const takeover = (s: InsightsSession): number | null => {
    if (s.initiatedBy === 'company') return null
    const at = s.dateOperatorAnswer || s.acceptedAt
    if (!at) return null
    const a = s.dateCreate
    return finite(
      cfg.bizOnly
        ? businessSeconds(a, at, cfg)
        : Math.max(
            0,
            Math.round((new Date(at).getTime() - new Date(a).getTime()) / 1000),
          ),
    )
  }

  // Esquecida: ficou aberta mais que stuckDays (ainda aberta ou fechada muito depois).
  const openSec = (s: InsightsSession): number | null =>
    s.status === 'closed'
      ? finite(s.waitClose)
      : finite((now.getTime() - new Date(s.dateCreate).getTime()) / 1000)
  const stuckOf = (s: InsightsSession) =>
    (openSec(s) ?? 0) > cfg.stuckDays * 86400

  // Espera NaN ainda é conversa respondida (o operador falou; só a data veio
  // ruim): ela sai das medianas via `fa`, mas não vira "perdida".
  const answered = (s: InsightsSession) =>
    s.waitAnswer != null || s.initiatedBy === 'company'
  const lostOf = (s: InsightsSession) => s.status === 'closed' && !answered(s)

  return { fa, takeover, openSec, stuckOf, answered, lostOf }
}
