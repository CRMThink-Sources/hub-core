import { vi } from 'vitest'
import type {
  InsightsDeal,
  InsightsSession,
  LiveOperator,
} from '@/modules/thinkzap/application/insights/metrics/types'
import type {
  InsightsChannelConfig,
  InsightsDataSource,
} from '@/modules/thinkzap/domain/ports/insights-data-source.port'

/** Sessão mínima para testes; cada teste sobrescreve só o que importa. */
export function session(over: Partial<InsightsSession>): InsightsSession {
  return {
    id: 1,
    configId: 1,
    source: 'hubthink_thinkzap',
    line: null,
    operatorId: 10,
    userCode: 'c1',
    chatId: 1,
    dateCreate: '2026-11-12T13:00:00.000Z',
    dateClose: null,
    status: 'answered',
    closeReason: null,
    vote: 'none',
    crmEntityType: null,
    crmEntityId: null,
    queueTransfers: 0,
    waitAnswer: null,
    waitClose: null,
    messageCount: 0,
    initiatedBy: 'client',
    msgsOperator: 0,
    msgsClient: 0,
    msgsBot: 0,
    replyTimes: [],
    clientReplied: null,
    firstOperatorAt: null,
    firstClientAt: null,
    lastOperatorAt: null,
    acceptedAt: null,
    ...over,
  }
}

/** Fonte em memória: filtra por data de criação como os adaptadores reais. */
export function fakeSource(opts: {
  mode?: 'full' | 'lean'
  sessions: InsightsSession[]
  users?: Record<string, string>
  userDept?: Record<string, { id: number; name: string }>
  deals?: InsightsDeal[]
  operators?: LiveOperator[]
  portal?: string | null
  channelConfigs?: InsightsChannelConfig[]
}) {
  const sessions = vi
    .fn<InsightsDataSource['sessions']>()
    .mockImplementation((from, to) =>
      Promise.resolve(
        opts.sessions.filter(s => {
          const d = new Date(s.dateCreate)
          return d >= from && d <= to
        }),
      ),
    )
  const directory = vi.fn<InsightsDataSource['directory']>().mockResolvedValue({
    users: opts.users ?? { '10': 'Ana', '20': 'Bruno' },
    userDept: opts.userDept ?? {
      '10': { id: 5, name: 'Vendas' },
      '20': { id: 6, name: 'Suporte' },
    },
  })
  const operators = vi
    .fn<InsightsDataSource['operators']>()
    .mockResolvedValue(opts.operators ?? [])
  const deals = vi
    .fn<InsightsDataSource['deals']>()
    .mockResolvedValue(opts.deals ?? [])
  const source: InsightsDataSource = {
    mode: opts.mode ?? 'lean',
    portal: opts.portal ?? null,
    sessions,
    directory,
    operators,
    deals,
  }
  if (opts.channelConfigs) {
    const list = opts.channelConfigs
    source.channelConfigs = vi
      .fn<NonNullable<InsightsDataSource['channelConfigs']>>()
      .mockResolvedValue(list)
  }
  return { source, sessions, operators, deals }
}

/** Procura NaN em qualquer nível do resultado (JSON o esconderia como null). */
export function findNaN(v: unknown, path = '$'): string[] {
  if (typeof v === 'number') return Number.isNaN(v) ? [path] : []
  if (Array.isArray(v)) return v.flatMap((x, i) => findNaN(x, `${path}[${i}]`))
  if (v && typeof v === 'object')
    return Object.entries(v).flatMap(([k, x]) => findNaN(x, `${path}.${k}`))
  return []
}
