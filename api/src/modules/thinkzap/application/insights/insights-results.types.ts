import type { InsightsConfig } from '@/modules/thinkzap/domain/insights-config'

/**
 * Parâmetros de `/api/dashboard` do original. Datas são `YYYY-MM-DD` no
 * horário de Brasília; `sources` é lista separada por vírgula; `g` agrupa o
 * relatório da equipe (day | week | month | total) e `sg` a série (day | week |
 * month).
 */
export type DashboardQuery = {
  from?: string
  to?: string
  dept?: string
  operator?: string
  slaMin?: string | number
  sources?: string
  g?: string
  sg?: string
}

export type TodayQuery = {
  sources?: string
  alertMin?: string | number
}

export type Recurrence = {
  clients: number
  recurrentClients: number
  recurrentClientsPct: number | null
  sessionsFromRecurrentPct: number | null
  recontact48: number
}

/**
 * Indicadores de um grupo de conversas. `spam`, `abandonPct`, `likes` e
 * `dislikes` dependem de dados que só a Vibe API traz: no modo `lean` vêm
 * null (zero seria mentira — o REST clássico não sabe o que é spam).
 */
export type Summary = Recurrence & {
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

export type OperatorRow = Summary &
  DealIndicators & {
    id: number
    name: string
    dept: string
    perDay: number
    activeDays: number
  }

export type DepartmentRow = Summary & { name: string; people: number }

export type TeamRow = UserIndicators & {
  bucket: string
  id: number
  name: string
  dept: string
}

export type LinkedDeal = {
  id: number
  title: string
  stage: string
  amount: number
  currency: string
}

export type WaitBucket = 'le5' | 'leSla' | 'le60' | 'gt60' | 'never' | 'waiting'

export type DashboardResult = {
  mode: 'full' | 'lean'
  filters: {
    departments: { id: string; name: string }[]
    operators: { id: number; name: string; deptId: string }[]
  }
  period: { from: string; to: string; days: number; slaMin: number }
  kpi: Summary
  prev: Summary
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
  /** Motivos de fechamento; null no modo `lean` (o REST clássico não tem). */
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
  wonList: (LinkedDeal & { operator: string; date: string })[]
  config: InsightsConfig
  sourcesSeen: string[]
  byHour: number[]
  series: {
    key: string
    arrived: number
    answered: number
    noAnswer: number
    pending: number
    contacts: number
    medianWait: number | null
    inSla: number
  }[]
  seriesGran: 'day' | 'week' | 'month'
  hourly: {
    hour: number
    arrived: number
    noAnswer: number
    medianWait: number | null
  }[]
  /** Meta de 1ª resposta configurada no canal (só Vibe API). */
  channelSla: { name: string; seconds: number }[] | null
  /**
   * Conversas do período cujas mensagens não puderam ser lidas (falha passageira
   * da Vibe API). Os indicadores que dependem de mensagem as contam sem esses
   * dados; a tela avisa. 0 quando nada ficou de fora (e sempre no REST clássico).
   */
  incompleteSessions: number
  portal: string | null
}

export type TodayResult = {
  mode: 'full' | 'lean'
  alertMin: number
  open: {
    id: number
    chatId: number | null
    status: string
    operator: string
    dept: string | undefined
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
    dept: string | undefined
    status: string
    activeSessions: number
  }[]
}
