import type { InsightsDeal, InsightsSession } from './metrics/types'
import type {
  DealIndicators,
  LinkedDeal,
  Recurrence,
  Summary,
  TeamRow,
  UserIndicators,
} from './insights-results.types'
import {
  avg,
  bucketKey,
  clockMin,
  finite,
  fmtDay,
  median,
  pct,
} from './insights-stats'
import { isOpenStatus, type SessionRules } from './session-rules'

/** Negócios ligados a cada conversa; fica fora da sessão para não mutá-la. */
export type DealLinks = Map<InsightsSession, LinkedDeal[]>

type Directory = {
  users: Record<string, string>
  userDept: Record<string, { id: number; name: string }>
}

// Recorrência: o mesmo cliente (userCode) voltando a chamar no período.
export function recurrence(valid: InsightsSession[]): Recurrence {
  const byClient: Record<string, InsightsSession[]> = {}
  for (const s of valid) (byClient[s.userCode] ||= []).push(s)
  const clients = Object.values(byClient)
  let recontact48 = 0
  for (const list of clients) {
    list.sort((a, b) => a.dateCreate.localeCompare(b.dateCreate))
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!
      const prevEnd = new Date(prev.dateClose || prev.dateCreate).getTime()
      if (new Date(list[i]!.dateCreate).getTime() - prevEnd <= 48 * 3600e3)
        recontact48++
    }
  }
  const rec = clients.filter(l => l.length > 1)
  return {
    clients: clients.length,
    recurrentClients: rec.length,
    recurrentClientsPct: pct(rec.length, clients.length),
    sessionsFromRecurrentPct: pct(
      rec.reduce((a, l) => a + l.length, 0),
      valid.length,
    ),
    recontact48,
  }
}

export function summarize(
  list: InsightsSession[],
  slaSec: number,
  rules: SessionRules,
  lean: boolean,
): Summary {
  const { fa, takeover, stuckOf, answered, lostOf } = rules
  const valid = list.filter(s => s.status !== 'spam')
  const timed = valid.filter(s => fa(s) != null)
  const noAnswer = valid.filter(lostOf)
  const closed = valid.filter(s => s.status === 'closed')
  const inSla = timed.filter(s => (fa(s) ?? Infinity) <= slaSec)
  const withCrm = valid.filter(s => s.crmEntityType)
  return {
    total: valid.length,
    spam: lean ? null : list.length - valid.length,
    closed: closed.length,
    answered: valid.filter(answered).length,
    open: valid.filter(s => isOpenStatus(s.status)).length,
    noAnswer: noAnswer.length,
    noAnswerPct: pct(noAnswer.length, closed.length),
    medianFirstAnswer: median(timed.map(fa).filter(x => x != null)),
    medianTakeover: median(valid.map(takeover).filter(x => x != null)),
    stuck: valid.filter(stuckOf).length,
    stuckOpen: valid.filter(s => s.status !== 'closed' && stuckOf(s)).length,
    slaPct: pct(inSla.length, timed.length),
    medianClose: median(
      closed.map(s => finite(s.waitClose)).filter(x => x != null),
    ),
    transfers: valid.reduce((a, s) => a + (s.queueTransfers || 0), 0),
    crmPct: pct(withCrm.length, valid.length),
    deals: valid.filter(s => s.crmEntityType === 'deal').length,
    // Abandono = fechada automaticamente; o motivo só vem da Vibe API.
    abandonPct: lean
      ? null
      : pct(closed.filter(s => s.closeReason === 'auto').length, closed.length),
    likes: lean ? null : valid.filter(s => s.vote === 'like').length,
    dislikes: lean ? null : valid.filter(s => s.vote === 'dislike').length,
    crmBreakdown: valid.reduce<Record<string, number>>((a, s) => {
      const k = s.crmEntityType || 'none'
      a[k] = (a[k] || 0) + 1
      return a
    }, {}),
    ...recurrence(valid),
  }
}

// ---- conversa -> negócio no CRM ----
// Regra: o negócio conta para a conversa se (a) a conversa está ligada direto a
// ele, ou (b) é do mesmo contato/lead e foi criado entre o início da conversa e
// dealWindowDays depois. Cada negócio conta uma vez, para a primeira conversa
// que se qualifica (e para quem encerrou essa conversa).
export function linkDeals(
  valid: InsightsSession[],
  deals: InsightsDeal[],
  dealWindowDays: number,
): DealLinks {
  const links: DealLinks = new Map(valid.map(s => [s, []]))
  const sorted = [...valid].sort((a, b) =>
    a.dateCreate.localeCompare(b.dateCreate),
  )
  const win = dealWindowDays * 864e5
  for (const d of deals) {
    const created = new Date(d.createdAt).getTime()
    const s = sorted.find(x => {
      if (x.crmEntityType === 'deal' && x.crmEntityId === d.id) return true
      const sameClient =
        (x.crmEntityType === 'contact' && x.crmEntityId === d.contactId) ||
        (x.crmEntityType === 'lead' && x.crmEntityId === d.leadId)
      // 1 min de folga: o negócio criado pelo próprio conector às vezes
      // nasce segundos antes da sessão.
      const start = new Date(x.dateCreate).getTime()
      return sameClient && created >= start - 60e3 && created <= start + win
    })
    if (s)
      links.get(s)?.push({
        id: d.id,
        title: d.title,
        stage: d.stageSemanticId,
        amount: Number(d.amount) || 0,
        currency: d.currency || 'BRL',
      })
  }
  return links
}

export function dealIndicators(
  list: InsightsSession[],
  links: DealLinks,
): DealIndicators {
  const of = (s: InsightsSession) => links.get(s) ?? []
  const ds = list.flatMap(of)
  const won = ds.filter(d => d.stage === 'S')
  return {
    dealsTotal: ds.length,
    dealsWon: won.length,
    dealsLost: ds.filter(d => d.stage === 'F').length,
    dealsOpen: ds.filter(d => d.stage === 'P').length,
    wonAmount: won.reduce((a, d) => a + d.amount, 0),
    convWithDeal: list.filter(s => of(s).length).length,
    convWithWon: list.filter(s => of(s).some(d => d.stage === 'S')).length,
  }
}

// ---- relatório por usuário (pedido da Global) com visão total / dia / semana / mês ----
export function userIndicators(
  list: InsightsSession[],
  rules: SessionRules,
  links: DealLinks,
): UserIndicators {
  const { fa, takeover, stuckOf, lostOf } = rules
  const initiated = list.filter(s => s.initiatedBy === 'company')
  const withReturn = initiated.filter(s => s.clientReplied != null)
  // 1º e último atendimento: por dia, a 1ª e a última mensagem humana; numa
  // semana/mês, a média desses horários.
  const days: Record<string, { first: number; last: number }> = {}
  for (const s of list) {
    const first = s.firstOperatorAt
    if (!first || !Number.isFinite(new Date(first).getTime())) continue
    const d = fmtDay(first)
    const day = (days[d] ||= { first: Infinity, last: -Infinity })
    day.first = Math.min(day.first, clockMin(first))
    day.last = Math.max(day.last, clockMin(s.lastOperatorAt || first))
  }
  const dv = Object.values(days)
  const firstAvg = avg(dv.map(x => x.first))
  const lastAvg = avg(dv.map(x => x.last))
  return {
    conversations: list.length,
    initiated: initiated.length,
    received: list.length - initiated.length,
    uniqueContacts: new Set(list.map(s => s.userCode)).size,
    msgsSent: list.reduce((a, s) => a + (s.msgsOperator || 0), 0),
    msgsReceived: list.reduce((a, s) => a + (s.msgsClient || 0), 0),
    avgFirstAnswer: avg(list.map(fa).filter(x => x != null)),
    avgReply: avg(
      list.flatMap(s => s.replyTimes || []).filter(x => Number.isFinite(x)),
    ),
    avgHandling: avg(
      list
        .filter(s => s.status === 'closed')
        .map(s => finite(s.waitClose))
        .filter(x => x != null),
    ),
    avgTakeover: avg(list.map(takeover).filter(x => x != null)),
    stuck: list.filter(stuckOf).length,
    ...dealIndicators(list, links),
    noAnswer: list.filter(lostOf).length,
    returnRate: pct(
      withReturn.filter(s => s.clientReplied).length,
      withReturn.length,
    ),
    returnBase: withReturn.length,
    firstOfDay: firstAvg == null ? null : finite(Math.round(firstAvg)),
    lastOfDay: lastAvg == null ? null : finite(Math.round(lastAvg)),
    daysWorked: dv.length,
  }
}

export function teamReport(
  valid: InsightsSession[],
  g: string,
  dir: Directory,
  rules: SessionRules,
  links: DealLinks,
): TeamRow[] {
  const rows: Record<string, InsightsSession[]> = {}
  for (const s of valid) {
    const k = `${bucketKey(s.dateCreate, g)}|${s.operatorId ?? 0}`
    ;(rows[k] ||= []).push(s)
  }
  return Object.entries(rows)
    .map(([k, list]) => {
      const [bucket = '', id = '0'] = k.split('|')
      return {
        bucket,
        id: Number(id),
        name: id === '0' ? 'Sem atendente' : dir.users[id] || `Usuário ${id}`,
        dept: id === '0' ? 'Fila' : dir.userDept[id]?.name || 'Sem setor',
        ...userIndicators(list, rules, links),
      }
    })
    .sort(
      (a, b) =>
        b.bucket.localeCompare(a.bucket) || b.conversations - a.conversations,
    )
}
