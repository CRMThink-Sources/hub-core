import { analyzeMessages } from '@/modules/thinkzap/application/insights/metrics/analyze-messages'
import type {
  InsightsDeal,
  InsightsSession,
  LiveOperator,
} from '@/modules/thinkzap/application/insights/metrics/types'
import type {
  InsightsChannelConfig,
  InsightsDataSource,
} from '@/modules/thinkzap/domain/ports/insights-data-source.port'
import {
  VibecodeAuthError,
  type VibecodeClient,
} from '@/modules/thinkzap/infra/clients/vibecode.client'
import { toMessageFields } from './classic-insights-data-source'

type Row = Record<string, any>
type Client = Pick<VibecodeClient, 'get' | 'getPage' | 'postPage'>

const PAGE = 50
// Teto do original (20000 sessões): protege contra `hasNextPage` que nunca acaba.
const MAX_SESSIONS = 20_000
// Mesmo teto do original: 40 páginas de 50 mensagens por chat.
const MAX_CHAT_PAGES = 40
// Listas de setores/usuários/negócios: teto só contra paginação infinita.
const MAX_LIST_PAGES = 400
// Chats lidos em paralelo (como o original): mais que isso estoura o limite da API.
const CHAT_CONCURRENCY = 5

const SESSIONS_TTL_MS = 120e3
const CHAT_TTL_MS = 120e3
const DIRECTORY_TTL_MS = 3600e3
const CONFIGS_TTL_MS = 3600e3
const OPERATORS_TTL_MS = 60e3

const DEAL_SELECT = [
  'id',
  'title',
  'stageSemanticId',
  'amount',
  'currency',
  'createdAt',
  'closedAt',
  'contactId',
  'leadId',
  'assignedById',
]

const validDate = (v: unknown): string | null =>
  typeof v === 'string' && v && Number.isFinite(new Date(v).getTime())
    ? v
    : null

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const text = (v: unknown): string | null =>
  typeof v === 'string' ? v || null : typeof v === 'number' ? String(v) : null

const ms = (v: unknown): number =>
  typeof v === 'string' || typeof v === 'number' ? new Date(v).getTime() : NaN

/**
 * Recusa da chave com certeza (HTTP 401/403). `success: false` também vira
 * `VibecodeAuthError`, mas sem status: não dá para afirmar que é a chave.
 */
export const isVibecodeKeyRevoked = (e: unknown): boolean =>
  e instanceof VibecodeAuthError && (e.status === 401 || e.status === 403)

/**
 * Sessão crua da Vibe API no formato do Insights. A API já entrega os campos
 * que o REST clássico não tem (spam, motivo de fechamento, nota, espera gravada
 * pelo Bitrix); aqui só se normalizam tipos e ausências.
 */
function toSession(r: Row): InsightsSession | null {
  const dateCreate = validDate(r.dateCreate)
  if (!dateCreate) return null
  const id = num(r.id) ?? 0
  // A recorrência agrupa por userCode; o original caía no userId. Sem nenhum
  // dos dois, cada sessão conta como cliente próprio em vez de juntar todas.
  const userCode = text(r.userCode) ?? text(r.userId) ?? `s${id}`
  return {
    id,
    configId: num(r.configId),
    source: String(r.source ?? ''),
    line: text(r.line),
    operatorId: num(r.operatorId) || null,
    userCode,
    chatId: num(r.chatId) || null,
    dateCreate,
    dateClose: validDate(r.dateClose),
    dateOperatorAnswer: validDate(r.dateOperatorAnswer),
    status: String(r.status ?? ''),
    closeReason: text(r.closeReason),
    vote: text(r.vote) ?? 'none',
    crmEntityType: text(r.crmEntityType),
    crmEntityId: num(r.crmEntityId) || null,
    queueTransfers: num(r.queueTransfers) ?? 0,
    waitAnswer: num(r.waitAnswer),
    waitClose: num(r.waitClose),
    messageCount: num(r.messageCount) ?? 0,
    ...toMessageFields({}),
  }
}

type ChatData = { msgs: Row[]; users: Record<string, Row> }
type Entry = { p: Promise<unknown>; expiresAt: number }

/**
 * Lê o Insights pela Vibe API (`mode = 'full'`): spam, motivo de fechamento,
 * nota do cliente, metas dos canais e status de operador ao vivo. Porta das
 * funções `vibe()` do `server.js` original.
 *
 * Nenhum erro daqui carrega a chave: o `VibecodeClient` já reconstrói as
 * mensagens sem os headers do axios, e este adaptador não loga.
 */
export class VibeInsightsDataSource implements InsightsDataSource {
  readonly mode = 'full' as const
  private portalName: string | null
  // Cache por instância (uma por app): o período atual e o anterior, e o
  // painel e o "hoje", pedem as mesmas leituras em sequência.
  private readonly memo = new Map<string, Entry>()

  constructor(
    private readonly client: Client,
    fallbackPortal: string | null = null,
  ) {
    this.portalName = fallbackPortal
  }

  get portal(): string | null {
    return this.portalName
  }

  /**
   * O cabeçalho mostra o portal do `/me`, como o original. Falha não impede o
   * painel: fica o domínio da instalação (a chave foi validada contra ele).
   */
  async loadPortal(): Promise<void> {
    try {
      const me = await this.client.get<{ portal?: string }>('/me')
      if (me?.portal) this.portalName = me.portal
    } catch {
      // Recusa da chave aparece na primeira leitura de dados, com fallback.
    }
  }

  // Guarda a promessa (deduplica chamadas simultâneas) e a descarta se falhar,
  // para uma recusa ou instabilidade não ficar presa no cache.
  private cached<T>(key: string, ttlMs: number, fn: () => Promise<T>) {
    const now = Date.now()
    const hit = this.memo.get(key)
    if (hit && hit.expiresAt > now) return hit.p as Promise<T>
    for (const [k, e] of this.memo) if (e.expiresAt <= now) this.memo.delete(k)
    const p = fn()
    this.memo.set(key, { p, expiresAt: now + ttlMs })
    p.catch(() => {
      if (this.memo.get(key)?.p === p) this.memo.delete(key)
    })
    return p
  }

  private async listAll(path: string): Promise<Row[]> {
    const out: Row[] = []
    const [base, query] = path.split('?')
    for (let i = 0; i < MAX_LIST_PAGES; i++) {
      const url = `${base}?limit=${PAGE}&offset=${i * PAGE}${query ? `&${query}` : ''}`
      const j = await this.client.getPage<Row[]>(url)
      const data = Array.isArray(j.data) ? j.data : []
      out.push(...data)
      if (!j.meta?.hasMore || !data.length) break
    }
    return out
  }

  sessions(from: Date, to: Date): Promise<InsightsSession[]> {
    const f = from.toISOString()
    const t = to.toISOString()
    return this.cached(`s:${f}:${t}`, SESSIONS_TTL_MS, async () => {
      const raw: Row[] = []
      for (let offset = 0; offset < MAX_SESSIONS; offset += PAGE) {
        const j = await this.client.postPage<{
          sessions?: Row[]
          hasNextPage?: boolean
        }>('/openlines/sessions/search', {
          dateCreateFrom: f,
          dateCreateTo: t,
          limit: PAGE,
          offset,
          order: 'dateCreate',
          orderDirection: 'asc',
        })
        raw.push(...(j.data?.sessions ?? []))
        if (!j.data?.hasNextPage) break
      }
      const list = raw
        .map(toSession)
        .filter((s): s is InsightsSession => s !== null)
      await this.enrich(list)
      return list
    })
  }

  // Lê o chat inteiro (paginado por lastId, do mais novo para o mais antigo)
  // até passar do início da sessão mais antiga dele.
  private chatMessages(chatId: number, since: string): Promise<ChatData> {
    return this.cached(`chat:${chatId}:${since}`, CHAT_TTL_MS, async () => {
      const msgs: Row[] = []
      const users: Record<string, Row> = {}
      const sinceMs = new Date(since).getTime()
      let lastId: string | null = null
      for (let i = 0; i < MAX_CHAT_PAGES; i++) {
        const j = await this.client.getPage<{
          messages?: Row[]
          users?: Row[]
        }>(
          `/chats/chat${chatId}/messages?limit=${PAGE}${lastId != null ? `&lastId=${lastId}` : ''}`,
        )
        for (const u of j.data?.users ?? []) users[String(u.id)] = u
        const page = j.data?.messages ?? []
        msgs.push(...page)
        if (page.length < PAGE) break
        const oldest = page.reduce((a, m) =>
          Number(m.id) < Number(a.id) ? m : a,
        )
        if (ms(oldest.date) < sinceMs) break
        lastId = text(oldest.id)
      }
      return { msgs, users }
    })
  }

  /**
   * Porta de `enrichVibe`: o histórico por sessão da Vibe API só traz a última
   * sessão do chat, então as métricas de mensagem saem do chat inteiro,
   * recortado pela janela de cada sessão (±5 s).
   */
  private async enrich(list: InsightsSession[]): Promise<void> {
    const byChat = new Map<number, InsightsSession[]>()
    for (const s of list) {
      if (s.chatId == null) continue
      const group = byChat.get(s.chatId) ?? []
      group.push(s)
      byChat.set(s.chatId, group)
    }
    const chats = [...byChat.entries()]
    for (let i = 0; i < chats.length; i += CHAT_CONCURRENCY) {
      await Promise.all(
        chats.slice(i, i + CHAT_CONCURRENCY).map(async ([chatId, group]) => {
          const since = group.reduce(
            (a, s) =>
              new Date(s.dateCreate).getTime() < new Date(a).getTime()
                ? s.dateCreate
                : a,
            group[0]?.dateCreate ?? '',
          )
          let data: ChatData
          try {
            data = await this.chatMessages(chatId, since)
          } catch (e) {
            // Como o original, chat ilegível segue sem métricas de mensagem;
            // mas chave recusada precisa subir para a leitura cair no clássico.
            if (isVibecodeKeyRevoked(e)) throw e
            return
          }
          const role = (id: string) => {
            if (id === '0') return 'system' as const
            const u = data.users[id]
            if (u?.connector) return 'client' as const
            if (u?.bot || u?.type === 'bot') return 'bot' as const
            return 'operator' as const
          }
          const dated = data.msgs.filter(m => Number.isFinite(ms(m.date)))
          for (const s of group) {
            const a = new Date(s.dateCreate).getTime() - 5000
            const b = s.dateClose
              ? new Date(s.dateClose).getTime() + 5000
              : Infinity
            const own = dated
              .filter(m => {
                const t = ms(m.date)
                return t >= a && t <= b
              })
              .map(m => ({
                id: text(m.id) ?? '',
                senderId: String(m.authorId),
                date: String(m.date),
                text: typeof m.text === 'string' ? m.text : undefined,
              }))
            Object.assign(s, toMessageFields(analyzeMessages(own, role)))
          }
        }),
      )
    }
  }

  directory() {
    return this.cached('dir', DIRECTORY_TTL_MS, async () => {
      type Dep = { name: string; parentId: number | null }
      const deps: Record<string, Dep> = {}
      for (const d of await this.listAll('/departments'))
        deps[String(d.id)] = {
          name: String(d.name ?? '').trim(),
          parentId: num(d.parentId),
        }
      const depth = (id: number, n = 0): number => {
        const parent = deps[String(id)]?.parentId
        return parent && n < 20 ? depth(parent, n + 1) : n
      }
      const users: Record<string, string> = {}
      const userDept: Record<string, { id: number; name: string }> = {}
      const userList = await this.listAll(
        '/users?select=id,name,lastName,departmentId',
      )
      for (const u of userList) {
        const uid = String(u.id)
        users[uid] = `${u.name ?? ''} ${u.lastName ?? ''}`.trim()
        const ids = ((u.departmentId ?? []) as unknown[])
          .map(Number)
          .filter(d => deps[String(d)])
        const best = ids.sort((a, b) => depth(b) - depth(a))[0]
        const bestDep = best !== undefined ? deps[String(best)] : undefined
        userDept[uid] =
          best !== undefined && bestDep
            ? { id: best, name: bestDep.name }
            : { id: 0, name: 'Sem setor' }
      }
      return { users, userDept }
    })
  }

  operators(): Promise<LiveOperator[]> {
    return this.cached('ops', OPERATORS_TTL_MS, async () => {
      const data = await this.client.get<{ operators?: Row[] }>(
        '/openlines/operators',
      )
      return (data?.operators ?? []).map(o => ({
        userId: Number(o.userId),
        configId: Number(o.configId),
        status: String(o.status ?? 'offline'),
        activeSessions: num(o.activeSessions) ?? 0,
      }))
    })
  }

  channelConfigs(): Promise<InsightsChannelConfig[]> {
    return this.cached('cfg', CONFIGS_TTL_MS, async () => {
      const data = await this.client.get<Row[]>('/openline-configs')
      return (Array.isArray(data) ? data : []).map(c => ({
        id: Number(c.id),
        name: String(c.name ?? ''),
        kpiFirstAnswerTime: num(c.kpiFirstAnswerTime),
      }))
    })
  }

  async deals(
    ids: number[],
    contactIds: number[],
    leadIds: number[],
  ): Promise<InsightsDeal[]> {
    const out = new Map<number, InsightsDeal>()
    const groups: [string, number[]][] = [
      ['id', ids],
      ['contactId', contactIds],
      ['leadId', leadIds],
    ]
    for (const [field, vals] of groups)
      for (let i = 0; i < vals.length; i += PAGE)
        for (let p = 0; p < MAX_LIST_PAGES; p++) {
          const j = await this.client.postPage<Row[]>('/deals/search', {
            filter: { [field]: { $in: vals.slice(i, i + PAGE) } },
            select: DEAL_SELECT,
            limit: PAGE,
            offset: p * PAGE,
          })
          for (const d of Array.isArray(j.data) ? j.data : [])
            out.set(Number(d.id), {
              id: Number(d.id),
              title: String(d.title ?? ''),
              stageSemanticId: String(d.stageSemanticId ?? ''),
              amount: num(d.amount) ?? 0,
              currency: String(d.currency ?? ''),
              createdAt: String(d.createdAt ?? ''),
              contactId: num(d.contactId) || null,
              leadId: num(d.leadId) || null,
            })
          if (!j.meta?.hasMore) break
        }
    return [...out.values()]
  }
}
