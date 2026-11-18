import type { InsightsConfig } from '@/modules/thinkzap/domain/insights-config'
import type { InsightsDataSource } from '@/modules/thinkzap/domain/ports/insights-data-source.port'
import type { LiveOperator } from './metrics/types'
import type { TodayQuery, TodayResult } from './insights-results.types'
import { fmtDay } from './insights-stats'
import { isOpenStatus, isThinkZap } from './session-rules'

const DAY_MS = 864e5
// Conversa aberta sem 1ª resposta há mais que isso aparece como atrasada.
const DEFAULT_ALERT_MIN = 30
// Abertas dos últimos 7 dias: mais antigas que isso já aparecem como
// esquecidas no painel do período.
const OPEN_WINDOW_DAYS = 7

/**
 * Painel "hoje": porta fiel de `today()` do original — conversas abertas,
 * atrasadas, o resumo do dia (Brasília) e o status ao vivo dos operadores.
 */
export async function buildToday(
  source: InsightsDataSource,
  cfg: InsightsConfig,
  q: TodayQuery,
  now: Date = new Date(),
): Promise<TodayResult> {
  const sources = q.sources ? q.sources.split(',') : []
  const alertMin = Number(q.alertMin) || DEFAULT_ALERT_MIN
  const nowMs = now.getTime()
  const from = new Date(nowMs - OPEN_WINDOW_DAYS * DAY_MS)
  // Status ao vivo do operador só existe na Vibe API; no modo lean nem chama.
  const [list, dir, ops] = await Promise.all([
    source.sessions(from, now),
    source.directory(),
    source.mode === 'lean'
      ? Promise.resolve<LiveOperator[]>([])
      : source.operators(),
  ])
  const { users, userDept } = dir
  const tz = list.filter(s => isThinkZap(s, sources, cfg))
  const configIds = new Set(tz.map(s => s.configId))

  const open = tz
    .filter(s => isOpenStatus(s.status))
    .map(s => {
      const ageMin = Math.round(
        (nowMs - new Date(s.dateCreate).getTime()) / 60e3,
      )
      return {
        id: s.id,
        chatId: s.chatId,
        status: s.status,
        operator:
          (s.operatorId != null ? users[s.operatorId] : undefined) ||
          (s.operatorId ? `Usuário ${s.operatorId}` : 'Sem atendente'),
        dept: s.operatorId ? userDept[s.operatorId]?.name : 'Fila / bot',
        ageMin,
        waitingFirstAnswer: s.waitAnswer == null,
        late: s.waitAnswer == null && ageMin > alertMin,
        crm: s.crmEntityType ? `${s.crmEntityType} ${s.crmEntityId}` : null,
      }
    })
    .sort((a, b) => Number(b.late) - Number(a.late) || b.ageMin - a.ageMin)

  const todayStr = fmtDay(now)
  const todays = tz.filter(
    s => fmtDay(s.dateCreate) === todayStr && s.status !== 'spam',
  )

  // Um operador aparece uma vez por canal; soma as sessões e fica com o
  // status não-offline de qualquer canal do ThinkZap.
  const opMap: Record<string, TodayResult['operators'][number]> = {}
  for (const o of ops.filter(x => configIds.has(x.configId))) {
    const cur = opMap[o.userId] ?? {
      userId: o.userId,
      name: users[o.userId] || `Usuário ${o.userId}`,
      dept: userDept[o.userId]?.name,
      status: 'offline',
      activeSessions: 0,
    }
    if (o.status !== 'offline') cur.status = o.status
    cur.activeSessions += o.activeSessions || 0
    opMap[o.userId] = cur
  }

  return {
    mode: source.mode,
    alertMin,
    open,
    late: open.filter(o => o.late).length,
    today: {
      total: todays.length,
      closed: todays.filter(s => s.status === 'closed').length,
      open: todays.filter(s => s.status !== 'closed').length,
    },
    operators: Object.values(opMap).sort(
      (a, b) => Number(a.status === 'offline') - Number(b.status === 'offline'),
    ),
  }
}
