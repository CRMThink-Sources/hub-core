import { analyzeMessages } from '@/modules/thinkzap/application/insights/metrics/analyze-messages'
import type {
  InsightsDeal,
  InsightsSession,
  LiveOperator,
  MessageFields,
} from '@/modules/thinkzap/application/insights/metrics/types'
import type { InsightsDataSource } from '@/modules/thinkzap/domain/ports/insights-data-source.port'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { apiLogger } from '@/shared/infra/logger'

type BitrixBody = { result?: unknown; next?: number; error?: string }

type Activity = {
  ID: string
  RESPONSIBLE_ID?: string
  START_TIME: string
  END_TIME?: string
  COMPLETED?: string
  OWNER_TYPE_ID?: string
  OWNER_ID?: string
  SUBJECT?: string
  ASSOCIATED_ENTITY_ID: string
}

type HistoryUser = { connector?: boolean; bot?: boolean; name?: string }
type History = {
  chatId?: number
  users?: Record<string, HistoryUser>
  message?: Record<
    string,
    { id: number; senderid: string; date: string; text?: string }
  >
}

type Analysis = Partial<ReturnType<typeof analyzeMessages>>
type Row = Record<string, any>

const OWNER: Record<string, string> = {
  '1': 'lead',
  '2': 'deal',
  '3': 'contact',
  '4': 'company',
}
const BATCH_SIZE = 50
const CACHE_TTL_MS = 300e3
const DAY_MS = 864e5

/**
 * Campos de métrica de mensagem de uma sessão (porta de `msgFields`). Aceita a
 * análise vazia porque sessão sem histórico legível ainda precisa ter os campos.
 */
export function toMessageFields(x: Analysis): MessageFields {
  return {
    initiatedBy: x.initiatedBy ?? null,
    msgsOperator: x.msgsOperator ?? 0,
    msgsClient: x.msgsClient ?? 0,
    msgsBot: x.msgsBot ?? 0,
    replyTimes: x.replyTimes ?? [],
    clientReplied: x.clientReplied ?? null,
    firstOperatorAt: x.firstOperator ?? null,
    firstClientAt: x.firstClient ?? null,
    lastOperatorAt: x.lastOperator ?? null,
    acceptedAt: x.acceptedAt ?? null,
  }
}

const toArray = (r: unknown): unknown[] =>
  Array.isArray(r) ? r : r && typeof r === 'object' ? Object.values(r) : []

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * Lê o Insights pelo REST clássico, para portais sem Vibecode. Limitações em
 * relação à Vibe API: sem spam, motivo de fechamento, nota do cliente e status de
 * operador ao vivo — por isso `mode = 'lean'`.
 *
 * O limite de requisições do Bitrix já é aplicado pelo `attachBitrixLimits` dentro
 * do `BitrixClient`; aqui não há espaçador nem retry próprio.
 */
export class ClassicInsightsDataSource implements InsightsDataSource {
  readonly mode = 'lean' as const

  // Nomes vistos no histórico (inclui bots, que o user.get de funcionários não traz).
  private readonly chatNames: Record<string, string> = {}
  // Cache por instância: o período atual e o anterior pedem a mesma leitura.
  private loaded: InsightsSession[] = []
  private loadedSince = Infinity
  private loadedAt = 0
  private inflight: { since: number; p: Promise<InsightsSession[]> } | null =
    null

  constructor(
    private readonly bitrix: Pick<BitrixClient, 'callMethod'>,
    readonly portal: string,
  ) {}

  private async call(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<BitrixBody> {
    const j = await this.bitrix.callMethod<BitrixBody>(method, params)
    if (j.error) throw new Error(`${method}: ${j.error}`)
    return j
  }

  private async listAll(
    method: string,
    params: Record<string, unknown>,
  ): Promise<Row[]> {
    const out: Row[] = []
    for (let start = 0; ; ) {
      const j = await this.call(method, { ...params, start })
      out.push(...(toArray(j.result) as Row[]))
      if (j.next == null) break
      start = j.next
    }
    return out
  }

  private async batch(
    cmds: Record<string, string>,
  ): Promise<Record<string, History | undefined>> {
    const out: Record<string, History | undefined> = {}
    const keys = Object.keys(cmds)
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const cmd = Object.fromEntries(
        keys.slice(i, i + BATCH_SIZE).map(k => [k, cmds[k]]),
      )
      const j = await this.call('batch', { halt: 0, cmd })
      const inner = (j.result as { result?: unknown } | undefined)?.result
      Object.assign(out, inner)
    }
    return out
  }

  private analyze(h: History): ReturnType<typeof analyzeMessages> {
    const users = h.users ?? {}
    // Data inválida viraria NaN em replyTimes; a mensagem é descartada.
    const msgs = Object.values(h.message ?? {})
      .filter(m => Number.isFinite(new Date(m.date).getTime()))
      .map(m => ({
        id: m.id,
        senderId: m.senderid,
        date: m.date,
        text: m.text,
      }))
    return analyzeMessages(msgs, id =>
      id === '0'
        ? 'system'
        : users[id]?.connector
          ? 'client'
          : users[id]?.bot
            ? 'bot'
            : 'operator',
    )
  }

  // O filtro de data do crm.activity.list é ignorado em silêncio pelo Bitrix, então
  // a data é filtrada aqui, em `sessions`, e a paginação para ao passar dela.
  private async allSessions(since: Date | number): Promise<InsightsSession[]> {
    const sinceMs = new Date(since).getTime() || 0
    if (
      Date.now() - this.loadedAt < CACHE_TTL_MS &&
      this.loadedSince <= sinceMs
    )
      return this.loaded
    if (this.inflight && this.inflight.since <= sinceMs) return this.inflight.p
    const p = this.loadSessions(sinceMs).finally(() => {
      if (this.inflight?.p === p) this.inflight = null
    })
    this.inflight = { since: sinceMs, p }
    return p
  }

  private async loadSessions(sinceMs: number): Promise<InsightsSession[]> {
    const acts: Activity[] = []
    for (let start = 0; ; ) {
      const j = await this.call('crm.activity.list', {
        filter: { PROVIDER_ID: 'IMOPENLINES_SESSION' },
        order: { ID: 'DESC' },
        start,
        select: [
          'ID',
          'RESPONSIBLE_ID',
          'START_TIME',
          'END_TIME',
          'COMPLETED',
          'OWNER_TYPE_ID',
          'OWNER_ID',
          'SUBJECT',
          'ASSOCIATED_ENTITY_ID',
        ],
      })
      const page = toArray(j.result) as Activity[]
      acts.push(...page)
      const oldest = page[page.length - 1]
      if (
        j.next == null ||
        !oldest ||
        new Date(oldest.START_TIME).getTime() < sinceMs - DAY_MS
      )
        break
      start = j.next
    }

    const hist = await this.batch(
      Object.fromEntries(
        acts.map(a => [
          `s${a.ASSOCIATED_ENTITY_ID}`,
          `imopenlines.session.history.get?SESSION_ID=${a.ASSOCIATED_ENTITY_ID}`,
        ]),
      ),
    )

    const sessions = acts.map(a => {
      const h = hist[`s${a.ASSOCIATED_ENTITY_ID}`]
      for (const [uid, u] of Object.entries(h?.users ?? {}))
        if (!u.connector && u.name)
          this.chatNames[uid] = u.bot ? `${u.name} (robô)` : u.name
      const x: Analysis = h ? this.analyze(h) : {}
      const start = a.START_TIME
      const closed = a.COMPLETED === 'Y'
      const ref = x.firstClient || start
      const waitAnswer = x.firstOperator
        ? Math.max(
            0,
            Math.round(
              (new Date(x.firstOperator).getTime() - new Date(ref).getTime()) /
                1000,
            ),
          )
        : null
      const session: InsightsSession = {
        id: Number(a.ASSOCIATED_ENTITY_ID),
        configId: null,
        source: /thinkzap/i.test(a.SUBJECT || '')
          ? 'hubthink_thinkzap'
          : 'other',
        line: (a.SUBJECT || '').match(/- ([^"]+)"/)?.[1]?.trim() || null,
        operatorId: Number(a.RESPONSIBLE_ID) || null,
        userCode: x.clientCode
          ? `c${x.clientCode}`
          : `o${a.OWNER_TYPE_ID}-${a.OWNER_ID}`,
        chatId: h?.chatId ?? null,
        dateCreate: start,
        dateClose: closed ? (a.END_TIME ?? null) : null,
        status: closed ? 'closed' : x.firstOperator ? 'answered' : 'new',
        closeReason: null,
        vote: 'none',
        crmEntityType: OWNER[a.OWNER_TYPE_ID ?? ''] ?? null,
        crmEntityId: Number(a.OWNER_ID) || null,
        queueTransfers: Math.max(0, (x.redirects || 0) - 1),
        waitAnswer,
        waitClose: closed
          ? Math.round(
              (new Date(a.END_TIME ?? '').getTime() -
                new Date(start).getTime()) /
                1000,
            )
          : null,
        messageCount: (x.msgsOperator || 0) + (x.msgsClient || 0),
        ...toMessageFields(x),
      }
      return session
    })
    this.loaded = sessions
    this.loadedSince = sinceMs
    this.loadedAt = Date.now()
    return sessions
  }

  async sessions(from: Date, to: Date): Promise<InsightsSession[]> {
    const all = await this.allSessions(from)
    return all.filter(s => {
      const d = new Date(s.dateCreate)
      return d >= from && d <= to
    })
  }

  async directory() {
    type Dep = { name: string; parentId: number | null }
    const deps: Record<string, Dep> = {}
    // Portal sem o escopo 'department': segue sem setores em vez de quebrar.
    const depList = await this.listAll('department.get', {}).catch(
      (e: unknown) => {
        apiLogger.warn({ err: errMsg(e) }, 'Insights: setores indisponíveis')
        return [] as Row[]
      },
    )
    for (const d of depList)
      deps[String(d.ID)] = {
        name: String(d.NAME ?? '').trim(),
        parentId: d.PARENT ? Number(d.PARENT) : null,
      }
    const depth = (id: number, n = 0): number => {
      const parent = deps[String(id)]?.parentId
      return parent && n < 20 ? depth(parent, n + 1) : n
    }

    // Lê as sessões da última semana para descobrir nomes (inclui robôs) no histórico.
    await this.allSessions(Date.now() - 7 * DAY_MS)
    const users: Record<string, string> = { ...this.chatNames }
    const userDept: Record<string, { id: number; name: string }> = {}
    const userList = await this.listAll('user.get', {
      FILTER: { USER_TYPE: 'employee' },
    }).catch((e: unknown) => {
      apiLogger.warn({ err: errMsg(e) }, 'Insights: usuários indisponíveis')
      return [] as Row[]
    })
    for (const u of userList) {
      const uid = String(u.ID)
      users[uid] = `${u.NAME ?? ''} ${u.LAST_NAME ?? ''}`.trim()
      const ids = ((u.UF_DEPARTMENT ?? []) as number[]).filter(
        d => deps[String(d)],
      )
      const best = ids.sort((a, b) => depth(b) - depth(a))[0]
      const bestDep = best !== undefined ? deps[String(best)] : undefined
      userDept[uid] =
        best !== undefined && bestDep
          ? { id: Number(best), name: bestDep.name }
          : { id: 0, name: 'Sem setor' }
    }
    for (const [uid, n] of Object.entries(this.chatNames))
      if (n.endsWith('(robô)')) userDept[uid] = { id: -2, name: 'Robô' }
    return { users, userDept }
  }

  // Status ao vivo só existe na Vibe API.
  operators(): Promise<LiveOperator[]> {
    return Promise.resolve([])
  }

  async deals(
    ids: number[],
    contactIds: number[],
    leadIds: number[],
  ): Promise<InsightsDeal[]> {
    const out = new Map<number, InsightsDeal>()
    const select = [
      'ID',
      'TITLE',
      'STAGE_SEMANTIC_ID',
      'OPPORTUNITY',
      'CURRENCY_ID',
      'DATE_CREATE',
      'CONTACT_ID',
      'LEAD_ID',
    ]
    const groups: [string, number[]][] = [
      ['ID', ids],
      ['CONTACT_ID', contactIds],
      ['LEAD_ID', leadIds],
    ]
    for (const [field, vals] of groups)
      for (let i = 0; i < vals.length; i += BATCH_SIZE) {
        const list = await this.listAll('crm.deal.list', {
          filter: { [`@${field}`]: vals.slice(i, i + BATCH_SIZE) },
          select,
        })
        for (const d of list)
          out.set(Number(d.ID), {
            id: Number(d.ID),
            title: String(d.TITLE ?? ''),
            stageSemanticId: String(d.STAGE_SEMANTIC_ID ?? ''),
            amount: Number(d.OPPORTUNITY) || 0,
            currency: String(d.CURRENCY_ID ?? ''),
            createdAt: String(d.DATE_CREATE ?? ''),
            contactId: Number(d.CONTACT_ID) || null,
            leadId: Number(d.LEAD_ID) || null,
          })
      }
    return [...out.values()]
  }
}
