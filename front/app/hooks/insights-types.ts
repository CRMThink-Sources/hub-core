/**
 * Contrato das rotas `/thinkzap/insights/*`. Espelha
 * `api/src/modules/thinkzap/application/insights/insights-results.types.ts` à
 * mão: o front não importa nada de `api/`.
 *
 * `mode: 'lean'` = sem chave Vibecode, dados do REST clássico do Bitrix. Nesse
 * modo os campos só da Vibe API (spam, abandono, notas, motivos, SLA do canal,
 * operadores ao vivo) vêm null ou vazios.
 */
export type InsightsMode = 'full' | 'lean'

export type InsightsConfig = {
  refMin: number
  bhStart: number
  bhEnd: number
  /** 0 = domingo. */
  bhDays: number[]
  bizOnly: boolean
  stuckDays: number
  dealWindowDays: number
  sources: string[]
}

/** `g` agrupa o relatório da equipe; `sg` agrupa a série do gráfico. */
export type TeamGranularity = 'total' | 'day' | 'week' | 'month'
export type SeriesGranularity = 'day' | 'week' | 'month'

export type DashboardQuery = {
  /** `YYYY-MM-DD` */
  from: string
  to: string
  dept?: string
  operator?: string
  slaMin?: number
  sources?: string
  g?: TeamGranularity
  sg?: SeriesGranularity
}

export type InsightsSummary = {
  clients: number
  recurrentClients: number
  recurrentClientsPct: number | null
  sessionsFromRecurrentPct: number | null
  recontact48: number
  total: number
  spam: number | null
  closed: number
  answered: number
  open: number
  noAnswer: number
  noAnswerPct: number | null
  medianFirstAnswer: number | null
  medianTakeover: number | null
  stuck: number
  stuckOpen: number
  slaPct: number | null
  medianClose: number | null
  transfers: number
  crmPct: number | null
  deals: number
  abandonPct: number | null
  likes: number | null
  dislikes: number | null
  crmBreakdown: Record<string, number>
}

export type DealIndicators = {
  dealsTotal: number
  dealsWon: number
  dealsLost: number
  dealsOpen: number
  wonAmount: number
  convWithDeal: number
  convWithWon: number
}

export type UserIndicators = DealIndicators & {
  conversations: number
  initiated: number
  received: number
  uniqueContacts: number
  msgsSent: number
  msgsReceived: number
  avgFirstAnswer: number | null
  avgReply: number | null
  avgHandling: number | null
  avgTakeover: number | null
  stuck: number
  noAnswer: number
  returnRate: number | null
  returnBase: number
  /** Minutos desde a meia-noite (Brasília). */
  firstOfDay: number | null
  lastOfDay: number | null
  daysWorked: number
}

export type OperatorRow = InsightsSummary &
  DealIndicators & {
    id: number
    name: string
    dept: string
    perDay: number
    activeDays: number
  }

export type DepartmentRow = InsightsSummary & { name: string; people: number }

export type TeamRow = UserIndicators & {
  bucket: string
  id: number
  name: string
  dept: string
}

export type WaitBucket = 'le5' | 'leSla' | 'le60' | 'gt60' | 'never' | 'waiting'

export type SeriesPoint = {
  key: string
  arrived: number
  answered: number
  noAnswer: number
  pending: number
  contacts: number
  medianWait: number | null
  inSla: number
}

export type HourlyPoint = {
  hour: number
  arrived: number
  noAnswer: number
  medianWait: number | null
}

export type DashboardResult = {
  mode: InsightsMode
  filters: {
    departments: { id: string; name: string }[]
    operators: { id: number; name: string; deptId: string }[]
  }
  period: { from: string; to: string; days: number; slaMin: number }
  kpi: InsightsSummary
  prev: InsightsSummary
  perDay: number
  operators: OperatorRow[]
  departments: DepartmentRow[]
  team: TeamRow[]
  teamTotal: UserIndicators
  daily: {
    day: string
    arrived: number
    answered: number
    noAnswer: number
    pending: number
  }[]
  /** heat[diaDaSemana][hora], 0 = domingo. */
  heat: number[][]
  reasons: Record<string, number> | null
  waitBuckets: {
    business: Partial<Record<WaitBucket, number>>
    outside: Partial<Record<WaitBucket, number>>
  }
  businessHours: {
    start: number
    end: number
    days: number[]
    medianInside: number | null
    medianOutside: number | null
  }
  lost: {
    id: number
    date: string
    operator: string
    closeReason: string | null
    inBH: boolean
    crmType: string | null
    crmId: number | null
    messages: number
  }[]
  stuckList: {
    id: number
    date: string
    days: number
    operator: string
    crmType: string | null
    crmId: number | null
  }[]
  wonList: {
    id: number
    title: string
    stage: string
    amount: number
    currency: string
    operator: string
    date: string
  }[]
  config: InsightsConfig
  sourcesSeen: string[]
  byHour: number[]
  series: SeriesPoint[]
  seriesGran: SeriesGranularity
  hourly: HourlyPoint[]
  channelSla: { name: string; seconds: number }[] | null
  portal: string | null
}

export type TodayResult = {
  mode: InsightsMode
  alertMin: number
  open: {
    id: number
    chatId: number | null
    status: string
    operator: string
    dept?: string
    ageMin: number
    waitingFirstAnswer: boolean
    late: boolean
    crm: string | null
  }[]
  late: number
  today: { total: number; closed: number; open: number }
  /** Status ao vivo dos operadores; vazio no modo `lean`. */
  operators: {
    userId: number
    name: string
    dept?: string
    status: string
    activeSessions: number
  }[]
}
