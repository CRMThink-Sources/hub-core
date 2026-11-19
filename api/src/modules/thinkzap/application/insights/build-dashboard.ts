import type { InsightsConfig } from '@/modules/thinkzap/domain/insights-config'
import type { InsightsDataSource } from '@/modules/thinkzap/domain/ports/insights-data-source.port'
import { apiLogger } from '@/shared/infra/logger'
import type { InsightsDeal, InsightsSession } from './metrics/types'
import type {
  DashboardQuery,
  DashboardResult,
  OperatorRow,
  WaitBucket,
} from './insights-results.types'
import {
  dealIndicators,
  linkDeals,
  summarize,
  teamReport,
  userIndicators,
} from './insights-indicators'
import { bucketKey, fmtDay, localParts, median } from './insights-stats'
import { isThinkZap, makeSessionRules } from './session-rules'

const DAY_MS = 864e5
// Padrão enxuto: cada dia de período custa uma leitura de sessões e de chats na
// Vibe API, e o painel lê também o período anterior (dobra o custo).
const DEFAULT_PERIOD_DAYS = 7
const SERIES_GRANS = ['day', 'week', 'month'] as const

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * Painel do período: porta fiel de `dashboard()` do original. Sem estado: a
 * configuração, a fonte e o "agora" entram por parâmetro; o cache fica com
 * quem chama.
 */
export async function buildDashboard(
  source: InsightsDataSource,
  cfg: InsightsConfig,
  q: DashboardQuery,
  now: Date = new Date(),
): Promise<DashboardResult> {
  const lean = source.mode === 'lean'
  const rules = makeSessionRules(cfg, source.mode, now)
  const { fa, answered, lostOf, stuckOf, openSec } = rules

  // Datas da query são dias de Brasília; sem `from`, os últimos 7 dias (contando hoje).
  const to = q.to ? new Date(q.to + 'T23:59:59-03:00') : now
  const from = q.from
    ? new Date(q.from + 'T00:00:00-03:00')
    : new Date(to.getTime() - (DEFAULT_PERIOD_DAYS - 1) * DAY_MS)
  const span = to.getTime() - from.getTime()
  // Período anterior do mesmo tamanho, terminando 1 s antes do atual.
  const prevFrom = new Date(from.getTime() - span)
  const prevTo = new Date(from.getTime() - 1000)
  const slaSec = (Number(q.slaMin) || cfg.refMin) * 60
  const sources = q.sources ? q.sources.split(',') : []

  // O período anterior (o mais longo) sai primeiro: a fonte clássica reaproveita
  // uma varredura em andamento só se ela começou em data igual ou anterior.
  // Medição: cada leitura marca o próprio fim, para ver qual segura o painel.
  const t0 = Date.now()
  const timed = <T>(p: Promise<T>): Promise<[T, number]> =>
    p.then(v => [v, Date.now() - t0])
  const [[allPrev, prevMs], [allCur, curMs], [dir, dirMs]] = await Promise.all([
    timed(source.sessions(prevFrom, prevTo)),
    timed(source.sessions(from, to)),
    timed(source.directory()),
  ])
  const readMs = Date.now() - t0
  const { users, userDept } = dir
  const userName = (id: number | string) => users[id] || `Usuário ${id}`
  const deptOf = (s: InsightsSession) =>
    s.operatorId
      ? userDept[s.operatorId] || { id: 0, name: 'Sem setor' }
      : { id: -1, name: 'Fila / bot' }
  const tzCur = allCur.filter(s => isThinkZap(s, sources, cfg))

  // opções de filtro: período inteiro, antes de aplicar setor/funcionário
  const deptOptions: Record<string, string> = {}
  const opOptions: Record<
    string,
    { id: number; name: string; deptId: string }
  > = {}
  for (const s of tzCur.filter(x => x.status !== 'spam')) {
    const d = deptOf(s)
    deptOptions[d.id] = d.name
    if (s.operatorId)
      opOptions[s.operatorId] = {
        id: s.operatorId,
        name: userName(s.operatorId),
        deptId: String(d.id),
      }
  }
  const scope = (s: InsightsSession) =>
    (!q.dept || String(deptOf(s).id) === q.dept) &&
    (!q.operator || String(s.operatorId) === q.operator)
  const cur = tzCur.filter(scope)
  const prev = allPrev.filter(s => isThinkZap(s, sources, cfg)).filter(scope)
  const valid = cur.filter(s => s.status !== 'spam')
  const days = Math.max(1, Math.round(span / DAY_MS))
  const dealsStart = Date.now()
  const fetchedDeals = await fetchDeals(source, valid)
  const dealsMs = Date.now() - dealsStart
  const links = linkDeals(valid, fetchedDeals, cfg.dealWindowDays)

  // por atendente (operatorId = quem finalizou)
  const byOp: Record<string, InsightsSession[]> = {}
  for (const s of valid) (byOp[s.operatorId ?? 0] ||= []).push(s)
  const operators: OperatorRow[] = Object.entries(byOp)
    .map(([id, list]) => {
      const activeDays = new Set(list.map(s => fmtDay(s.dateCreate))).size
      return {
        id: Number(id),
        name: id === '0' ? 'Sem atendente (fila/bot)' : userName(id),
        dept: id === '0' ? 'Fila / bot' : userDept[id]?.name || 'Sem setor',
        ...summarize(list, slaSec, rules, lean),
        perDay: Math.round((list.length / activeDays) * 10) / 10,
        activeDays,
        ...dealIndicators(list, links),
      }
    })
    .sort((a, b) => b.total - a.total)

  // por setor
  const byDept: Record<string, InsightsSession[]> = {}
  for (const s of valid) (byDept[deptOf(s).name] ||= []).push(s)
  const departments = Object.entries(byDept)
    .map(([name, list]) => ({
      name,
      ...summarize(list, slaSec, rules, lean),
      people: new Set(list.map(s => s.operatorId).filter(Boolean)).size,
    }))
    .sort((a, b) => b.total - a.total)

  // série diária e heatmap (horário de Brasília)
  const daily: Record<string, DashboardResult['daily'][number]> = {}
  const heat = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  for (const s of valid) {
    const d = fmtDay(s.dateCreate)
    const row = (daily[d] ||= {
      day: d,
      arrived: 0,
      answered: 0,
      noAnswer: 0,
      pending: 0,
    })
    row.arrived++
    if (answered(s)) row.answered++
    else if (s.status === 'closed') row.noAnswer++
    else row.pending++
    const { dow, hour } = localParts(s.dateCreate)
    const line = heat[dow]
    if (line) line[hour] = (line[hour] ?? 0) + 1
  }

  // Quanto o cliente esperou: faixas simples, separadas por dentro/fora do
  // horário comercial.
  const BH = { start: cfg.bhStart, end: cfg.bhEnd, days: cfg.bhDays }
  const inBH = (iso: string) => {
    const { dow, hour } = localParts(iso)
    return cfg.bhDays.includes(dow) && hour >= BH.start && hour < BH.end
  }
  const bucketOf = (s: InsightsSession): WaitBucket | null => {
    const w = fa(s)
    if (w == null)
      return lostOf(s) ? 'never' : s.status === 'closed' ? null : 'waiting'
    return w <= 300
      ? 'le5'
      : w <= slaSec
        ? 'leSla'
        : w <= 3600
          ? 'le60'
          : 'gt60'
  }
  const waitBuckets: DashboardResult['waitBuckets'] = {
    business: {},
    outside: {},
  }
  for (const s of valid) {
    const g = inBH(s.dateCreate) ? 'business' : 'outside'
    const b = bucketOf(s)
    if (b) waitBuckets[g][b] = (waitBuckets[g][b] || 0) + 1
  }
  const bhMedian = (inside: boolean) =>
    median(
      valid
        .filter(s => inBH(s.dateCreate) === inside)
        .map(fa)
        .filter(x => x != null),
    )

  const operatorLabel = (s: InsightsSession, none: string) =>
    s.operatorId ? userName(s.operatorId) : none

  // Conversas perdidas (encerradas sem nenhuma resposta) — lista acionável
  const lost = valid
    .filter(lostOf)
    .sort((a, b) => b.dateCreate.localeCompare(a.dateCreate))
    .slice(0, 15)
    .map(s => ({
      id: s.id,
      date: s.dateCreate,
      operator: operatorLabel(s, 'Ninguém assumiu'),
      closeReason: s.closeReason,
      inBH: inBH(s.dateCreate),
      crmType: s.crmEntityType,
      crmId: s.crmEntityId,
      messages: s.messageCount,
    }))

  // Conversas esquecidas: as que ainda estão abertas há mais de stuckDays
  const stuckList = valid
    .filter(s => s.status !== 'closed' && stuckOf(s))
    .sort((a, b) => a.dateCreate.localeCompare(b.dateCreate))
    .slice(0, 20)
    .map(s => ({
      id: s.id,
      date: s.dateCreate,
      days: Math.floor((openSec(s) ?? 0) / 86400),
      operator: operatorLabel(s, 'Ninguém assumiu'),
      crmType: s.crmEntityType,
      crmId: s.crmEntityId,
    }))
  const wonList = valid
    .flatMap(s =>
      (links.get(s) ?? [])
        .filter(d => d.stage === 'S')
        .map(d => ({
          ...d,
          operator: operatorLabel(s, 'Sem atendente'),
          date: s.dateCreate,
        })),
    )
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 15)

  // Horários de pico (só hora do dia, mais fácil de ler que o mapa dia × hora)
  const byHour = Array<number>(24).fill(0)
  for (const s of valid) {
    const { hour } = localParts(s.dateCreate)
    if (hour in byHour) byHour[hour] = (byHour[hour] ?? 0) + 1
  }

  // Gráficos cruzados: volume × rapidez no tempo (segue Dia/Semana/Mês) e por
  // hora do dia
  const gSeries = SERIES_GRANS.find(g => g === q.sg) ?? 'day'
  const ser: Record<
    string,
    {
      key: string
      arrived: number
      answered: number
      noAnswer: number
      pending: number
      waits: number[]
      contacts: Set<string>
    }
  > = {}
  const hours = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    arrived: 0,
    noAnswer: 0,
    waits: [] as number[],
  }))
  for (const s of valid) {
    const k = bucketKey(s.dateCreate, gSeries)
    const x = (ser[k] ||= {
      key: k,
      arrived: 0,
      answered: 0,
      noAnswer: 0,
      pending: 0,
      waits: [],
      contacts: new Set(),
    })
    x.arrived++
    x.contacts.add(s.userCode)
    const w = fa(s)
    if (answered(s)) {
      x.answered++
      if (w != null) x.waits.push(w)
    } else if (s.status === 'closed') x.noAnswer++
    else x.pending++
    const hh = hours[localParts(s.dateCreate).hour]
    if (hh) {
      hh.arrived++
      if (w != null) hh.waits.push(w)
      else if (lostOf(s)) hh.noAnswer++
    }
  }
  const series = Object.values(ser)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ waits, contacts, ...x }) => ({
      ...x,
      contacts: contacts.size,
      medianWait: median(waits),
      inSla: waits.filter(w => w <= slaSec).length,
    }))
  const hourly = hours.map(({ waits, ...h }) => ({
    ...h,
    medianWait: median(waits),
  }))

  // Motivo de fechamento só existe na Vibe API: no REST clássico tudo cairia
  // em "outro", o que parece dado e não é.
  let reasons: Record<string, number> | null = null
  if (!lean) {
    reasons = {}
    for (const s of valid.filter(x => x.status === 'closed')) {
      const k = s.closeReason || 'outro'
      reasons[k] = (reasons[k] || 0) + 1
    }
  }

  const slaStart = Date.now()
  const channelSlaResult = await channelSla(source, valid)
  apiLogger.info(
    {
      insightsTiming: 'dashboard',
      portal: source.portal ?? null,
      mode: source.mode,
      days,
      sessionsCur: allCur.length,
      sessionsPrev: allPrev.length,
      // Fim de cada leitura contado desde o início (rodam em paralelo).
      prevMs,
      curMs,
      dirMs,
      readMs,
      dealsMs,
      channelSlaMs: Date.now() - slaStart,
      totalMs: Date.now() - t0,
    },
    'Insights: painel calculado',
  )

  return {
    mode: source.mode,
    filters: {
      departments: Object.entries(deptOptions)
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      operators: Object.values(opOptions).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    },
    period: {
      from: from.toISOString(),
      to: to.toISOString(),
      days,
      slaMin: slaSec / 60,
    },
    kpi: summarize(cur, slaSec, rules, lean),
    prev: summarize(prev, slaSec, rules, lean),
    perDay: Math.round((valid.length / days) * 10) / 10,
    operators,
    departments,
    team: teamReport(valid, q.g || 'total', dir, rules, links),
    teamTotal: userIndicators(valid, rules, links),
    daily: Object.values(daily).sort((a, b) => a.day.localeCompare(b.day)),
    heat,
    reasons,
    waitBuckets,
    businessHours: {
      ...BH,
      medianInside: bhMedian(true),
      medianOutside: bhMedian(false),
    },
    lost,
    stuckList,
    wonList,
    config: cfg,
    sourcesSeen: [...new Set(allCur.map(s => s.source))],
    byHour,
    series,
    seriesGran: gSeries,
    hourly,
    channelSla: channelSlaResult,
    portal: source.portal ?? null,
  }
}

/**
 * Falha ao buscar negócios não derruba o painel: os indicadores de venda ficam
 * zerados e o resto continua (como no original).
 */
async function fetchDeals(
  source: InsightsDataSource,
  valid: InsightsSession[],
): Promise<InsightsDeal[]> {
  const idsOf = (type: string) => [
    ...new Set(
      valid
        .filter(s => s.crmEntityType === type && s.crmEntityId != null)
        .map(s => s.crmEntityId as number),
    ),
  ]
  try {
    return await source.deals(idsOf('deal'), idsOf('contact'), idsOf('lead'))
  } catch (e) {
    apiLogger.warn({ err: errMsg(e) }, 'Insights: negócios indisponíveis')
    return []
  }
}

/**
 * Meta de 1ª resposta configurada no próprio canal. O painel usa a meta
 * escolhida pelo cliente, mas mostra a do canal para comparar. Sem a Vibe API
 * (modo `lean`) ou se a leitura falhar, fica null.
 */
async function channelSla(
  source: InsightsDataSource,
  valid: InsightsSession[],
): Promise<DashboardResult['channelSla']> {
  if (source.mode === 'lean' || !source.channelConfigs) return null
  try {
    const configs = await source.channelConfigs()
    const ids = new Set(valid.map(x => x.configId))
    return configs
      .filter(c => ids.has(c.id) && Number(c.kpiFirstAnswerTime) > 0)
      .map(c => ({ name: c.name, seconds: Number(c.kpiFirstAnswerTime) }))
  } catch {
    return null
  }
}
