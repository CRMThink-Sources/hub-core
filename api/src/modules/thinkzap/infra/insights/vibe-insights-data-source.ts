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
  VibecodeRequestError,
  type VibecodeClient,
} from '@/modules/thinkzap/infra/clients/vibecode.client'
import { apiLogger } from '@/shared/infra/logger'
import { toMessageFields } from './classic-insights-data-source'
import type { SessionDayCache } from './session-day-cache'

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

const DAY_MS = 864e5
// Dia de Brasília (UTC-3, sem horário de verão desde 2019): é como o Insights
// divide os períodos. Dias fechados mudam pouco (só fechamento tardio).
const BRT_OFFSET_MS = 3 * 3600e3
const SESSIONS_TTL_MS = 30 * 60e3
// Hoje e ontem ainda recebem sessões novas e fechamentos.
const SESSIONS_RECENT_TTL_MS = 120e3
const CHAT_TTL_MS = 120e3
// Dia com sessão sem mensagens lidas (falha passageira): relê na próxima abertura.
const INCOMPLETE_DAY_TTL_MS = 120e3
const DEFAULT_CLOSED_DAY_TTL_MS = 24 * 3600e3
const DEFAULT_CHAT_429_FINAL_WAIT_MS = 5000
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

// 'AAAA-MM-DD' do dia de Brasília que contém o instante.
const brtDayKey = (t: number): string =>
  new Date(t - BRT_OFFSET_MS).toISOString().slice(0, 10)

// Instante (ms) em que o dia de Brasília começa.
const brtDayStart = (key: string): number =>
  Date.parse(`${key}T00:00:00Z`) + BRT_OFFSET_MS

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

type ChatData = {
  msgs: Row[]
  users: Record<string, Row>
  // Instante (ms) mais antigo que a leitura cobre; -Infinity = chat inteiro.
  coveredSince: number
}
type Entry = { p: Promise<unknown>; expiresAt: number }

export type VibeSourceOptions = {
  /** Sessões por dia fora da memória (Redis). Sem ele, só o cache do processo. */
  dayCache?: SessionDayCache
  /** Validade de um dia fechado (anterior a ontem) no `dayCache`. */
  closedDayTtlMs?: number
  /** Espera da última nova tentativa quando a leitura de um chat dá 429. */
  chat429FinalWaitMs?: number
  /** Espera injetável: o teste não aguarda de verdade. */
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Falha que pode passar sozinha (429, 5xx, timeout/rede): a sessão fica marcada
 * como incompleta. 4xx permanentes (um 403 em chat de que o dono não participa)
 * nunca passariam, e marcá-los deixaria o dia reaberto para sempre.
 */
const isTransientChatFailure = (e: unknown): boolean =>
  e instanceof VibecodeRequestError &&
  (e.status === undefined || e.status === 429 || e.status >= 500)

/**
 * Lê o Insights pela Vibe API (`mode = 'full'`): spam, motivo de fechamento,
 * nota do cliente, metas dos canais e status de operador ao vivo. Porta das
 * funções `vibe()` do `server.js` original.
 *
 * Nenhum erro daqui carrega a chave: o `VibecodeClient` já reconstrói as
 * mensagens sem os headers do axios, e o único log (chat ilegível) leva só o
 * nome do erro e o status HTTP.
 */
export class VibeInsightsDataSource implements InsightsDataSource {
  readonly mode = 'full' as const
  private portalName: string | null
  // Cache por instância (uma por app): o período atual e o anterior, e o
  // painel e o "hoje", pedem as mesmas leituras em sequência.
  private readonly memo = new Map<string, Entry>()
  // Só para medição (log de `enrich`): páginas de chat pedidas à API.
  private chatPagesFetched = 0
  private readonly dayCache: SessionDayCache | undefined
  private readonly closedDayTtlMs: number
  private readonly chat429FinalWaitMs: number
  private readonly sleep: (ms: number) => Promise<void>

  constructor(
    private readonly client: Client,
    fallbackPortal: string | null = null,
    // Relógio injetável: os TTLs do cache dependem de "hoje" em Brasília.
    private readonly now: () => number = Date.now,
    opts: VibeSourceOptions = {},
  ) {
    this.portalName = fallbackPortal
    this.dayCache = opts.dayCache
    this.closedDayTtlMs = opts.closedDayTtlMs ?? DEFAULT_CLOSED_DAY_TTL_MS
    this.chat429FinalWaitMs =
      opts.chat429FinalWaitMs ?? DEFAULT_CHAT_429_FINAL_WAIT_MS
    this.sleep = opts.sleep ?? defaultSleep
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
    const now = this.now()
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

  /**
   * Cache por dia de Brasília (UTC-3, fixo): alargar o período só lê os dias
   * que ainda não estão guardados. Cada entrada `sd:AAAA-MM-DD` guarda as
   * sessões com `dateCreate` naquele dia, já com as métricas de mensagem.
   *
   * Os dias das pontas são lidos inteiros (e não só até `from`/`to`): assim a
   * entrada do dia é sempre completa e pode ser cacheada; o recorte exato
   * [from, to] é feito só na devolução. Dias ausentes e consecutivos saem numa
   * única busca paginada.
   */
  async sessions(from: Date, to: Date): Promise<InsightsSession[]> {
    const fromMs = from.getTime()
    const toMs = to.getTime()
    if (!(fromMs <= toMs)) return []
    const nowMs = this.now()
    const todayStart = brtDayStart(brtDayKey(nowMs))
    const days: string[] = []
    for (let t = brtDayStart(brtDayKey(fromMs)); t <= toMs; t += DAY_MS)
      days.push(brtDayKey(t))

    for (const [k, e] of this.memo)
      if (e.expiresAt <= nowMs) this.memo.delete(k)

    const parts = new Map<string, Promise<InsightsSession[]>>()
    const fromMemo = (day: string) => {
      const hit = this.memo.get(`sd:${day}`)
      return hit && hit.expiresAt > nowMs
        ? (hit.p as Promise<InsightsSession[]>)
        : null
    }
    const missing: string[] = []
    for (const day of days) {
      const hit = fromMemo(day)
      if (hit) parts.set(day, hit)
      else missing.push(day)
    }

    // Dias fechados guardados fora do processo (sobrevivem a deploy): só o que
    // não está lá cai na leitura da API.
    if (missing.length && this.dayCache) {
      const stored = await Promise.all(
        missing.map(day => this.readDayCache(day)),
      )
      missing.forEach((day, i) => {
        // Outra chamada pode ter começado a ler o dia enquanto esta esperava o Redis.
        const hit = fromMemo(day)
        const list = stored[i]
        if (hit) parts.set(day, hit)
        else if (list) parts.set(day, Promise.resolve(list))
      })
    }

    let run: string[] = []
    const flush = () => {
      if (run.length) this.fetchDays(run, todayStart, nowMs, parts)
      run = []
    }
    for (const day of days) {
      if (parts.has(day)) flush()
      else run.push(day)
    }
    flush()

    const lists = await Promise.all(days.map(d => parts.get(d)!))
    return lists
      .flat()
      .filter(s => {
        const t = new Date(s.dateCreate).getTime()
        return t >= fromMs && t <= toMs
      })
      .sort(
        (a, b) =>
          new Date(a.dateCreate).getTime() - new Date(b.dateCreate).getTime(),
      )
  }

  // `null` = sem cache (ou Redis fora do ar): a leitura segue, só não guarda.
  private async readGeneration(): Promise<number | null> {
    if (!this.dayCache) return null
    try {
      return await this.dayCache.generation()
    } catch {
      return null
    }
  }

  // Redis fora do ar não pode derrubar o painel: vira dia ausente e relê na API.
  private async readDayCache(day: string): Promise<InsightsSession[] | null> {
    try {
      return (await this.dayCache?.read(day)) ?? null
    } catch (e) {
      apiLogger.warn(
        { errorName: e instanceof Error ? e.name : 'unknown' },
        'Insights: cache de sessões por dia indisponível, lendo da Vibe API',
      )
      return null
    }
  }

  // Grava os dias lidos. Falha de gravação não pode perder a leitura que já deu
  // certo: o dia só deixa de ficar guardado.
  private async writeDayCache(
    byDay: Map<string, InsightsSession[]>,
    wanted: Set<string>,
    generation: number,
  ): Promise<void> {
    const cache = this.dayCache
    if (!cache) return
    const todayStart = brtDayStart(brtDayKey(this.now()))
    try {
      await Promise.all(
        [...wanted].map(day => {
          const sessions = byDay.get(day) ?? []
          // Hoje e ontem ainda mudam; sessão sem mensagens lidas pede nova leitura.
          const recent = brtDayStart(day) >= todayStart - DAY_MS
          const incomplete = sessions.some(s => s.incomplete)
          const ttl = recent
            ? SESSIONS_RECENT_TTL_MS
            : incomplete
              ? INCOMPLETE_DAY_TTL_MS
              : this.closedDayTtlMs
          return cache.write(day, sessions, ttl, generation)
        }),
      )
    } catch (e) {
      apiLogger.warn(
        { errorName: e instanceof Error ? e.name : 'unknown' },
        'Insights: não foi possível guardar as sessões por dia',
      )
    }
  }

  // Uma busca paginada para a faixa contínua de dias ausentes; cada dia guarda
  // a sua fatia da mesma promessa (deduplica pedidos simultâneos). Falha não
  // fica presa: some do cache junto com a promessa.
  private fetchDays(
    run: string[],
    todayStart: number,
    nowMs: number,
    parts: Map<string, Promise<InsightsSession[]>>,
  ) {
    const first = run[0]!
    const last = run[run.length - 1]!
    const byDay = this.readSessions(
      new Date(brtDayStart(first)),
      new Date(brtDayStart(last) + DAY_MS - 1),
      new Set(run),
    )
    for (const day of run) {
      const p = byDay.then(m => m.get(day) ?? [])
      // Hoje e ontem ainda mudam (sessões novas, fechamentos); o resto não.
      const recent = brtDayStart(day) >= todayStart - DAY_MS
      this.memo.set(`sd:${day}`, {
        p,
        expiresAt: nowMs + (recent ? SESSIONS_RECENT_TTL_MS : SESSIONS_TTL_MS),
      })
      p.catch(() => {
        if (this.memo.get(`sd:${day}`)?.p === p) this.memo.delete(`sd:${day}`)
      })
      parts.set(day, p)
    }
  }

  private async readSessions(
    from: Date,
    to: Date,
    wanted: Set<string>,
  ): Promise<Map<string, InsightsSession[]>> {
    const raw: Row[] = []
    const startedAt = Date.now()
    // Geração lida ANTES da leitura: se a configuração mudar durante ela, o que
    // foi lido com a configuração antiga não pode ser guardado.
    const generation = await this.readGeneration()
    let pages = 0
    for (let offset = 0; offset < MAX_SESSIONS; offset += PAGE) {
      pages += 1
      const j = await this.client.postPage<{
        sessions?: Row[]
        hasNextPage?: boolean
      }>('/openlines/sessions/search', {
        dateCreateFrom: from.toISOString(),
        dateCreateTo: to.toISOString(),
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
    const listedMs = Date.now() - startedAt
    await this.enrich(list)
    // Medição: separa o custo de listar sessões do de ler os chats.
    apiLogger.info(
      {
        insightsTiming: 'vibe.readSessions',
        portal: this.portalName,
        days: wanted.size,
        sessions: list.length,
        sessionPages: pages,
        listMs: listedMs,
        totalMs: Date.now() - startedAt,
      },
      'Insights: sessões lidas na Vibe API',
    )
    const byDay = new Map<string, InsightsSession[]>()
    for (const s of list) {
      const day = brtDayKey(new Date(s.dateCreate).getTime())
      // Fora da faixa pedida: não pode entrar numa entrada de dia que não foi
      // lida por inteiro.
      if (!wanted.has(day)) continue
      const bucket = byDay.get(day) ?? []
      bucket.push(s)
      byDay.set(day, bucket)
    }
    if (generation !== null) await this.writeDayCache(byDay, wanted, generation)
    return byDay
  }

  /**
   * Cache por chat (e não por chat+`since`): alargar o período reaproveita o que
   * já foi lido. A entrada guarda até onde a leitura chegou (`coveredSince`);
   * um `since` mais novo ou igual sai dela sem chamar a API, e um mais antigo
   * relê o chat até o novo `since` e substitui a entrada.
   */
  private async chatMessages(chatId: number, since: string): Promise<ChatData> {
    const key = `chat:${chatId}`
    const sinceMs = new Date(since).getTime()
    const hit = this.memo.get(key)
    if (hit && hit.expiresAt > this.now()) {
      try {
        const data = (await hit.p) as ChatData
        if (sinceMs >= data.coveredSince) return data
      } catch {
        // Leitura em andamento falhou: tenta de novo abaixo, com a própria.
      }
    }
    const p = this.readChatRetrying(chatId, sinceMs)
    this.memo.set(key, { p, expiresAt: this.now() + CHAT_TTL_MS })
    p.catch(() => {
      if (this.memo.get(key)?.p === p) this.memo.delete(key)
    })
    return p
  }

  // O cliente já tenta de novo o 429 com espera curta; passando disso, uma última
  // tentativa depois de uma espera maior, antes de dar a sessão por incompleta.
  // A concorrência não muda: o 429 é justamente o limite da API.
  private async readChatRetrying(
    chatId: number,
    sinceMs: number,
  ): Promise<ChatData> {
    try {
      return await this.readChat(chatId, sinceMs)
    } catch (e) {
      if (!(e instanceof VibecodeRequestError && e.status === 429)) throw e
      await this.sleep(this.chat429FinalWaitMs)
      return this.readChat(chatId, sinceMs)
    }
  }

  // Lê o chat inteiro (paginado por lastId, do mais novo para o mais antigo)
  // até passar do início da sessão mais antiga dele.
  private async readChat(chatId: number, sinceMs: number): Promise<ChatData> {
    const msgs: Row[] = []
    const users: Record<string, Row> = {}
    // Chegar ao início do chat cobre qualquer `since`.
    let coveredSince = Number.NEGATIVE_INFINITY
    let lastId: string | null = null
    for (let i = 0; i < MAX_CHAT_PAGES; i++) {
      this.chatPagesFetched += 1
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
      if (ms(oldest.date) < sinceMs) {
        coveredSince = sinceMs
        break
      }
      lastId = text(oldest.id)
      // Se o teto de páginas cortar a leitura, só vale até aqui.
      coveredSince = ms(oldest.date)
    }
    return { msgs, users, coveredSince }
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
    const startedAt = Date.now()
    const pagesBefore = this.chatPagesFetched
    const slowest = { chatId: 0, ms: 0 }
    try {
      await this.enrichChats(chats, slowest)
    } finally {
      // Medição. `chatPages` é o delta de um contador da instância: duas
      // leituras simultâneas se misturam, então vale como ordem de grandeza.
      apiLogger.info(
        {
          insightsTiming: 'vibe.enrich',
          portal: this.portalName,
          chats: chats.length,
          chatPages: this.chatPagesFetched - pagesBefore,
          slowestChatId: slowest.chatId,
          slowestChatMs: slowest.ms,
          totalMs: Date.now() - startedAt,
        },
        'Insights: chats lidos na Vibe API',
      )
    }
  }

  private async enrichChats(
    chats: [number, InsightsSession[]][],
    slowest: { chatId: number; ms: number },
  ): Promise<void> {
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
          const chatStart = Date.now()
          try {
            data = await this.chatMessages(chatId, since)
            const took = Date.now() - chatStart
            if (took > slowest.ms) {
              slowest.chatId = chatId
              slowest.ms = took
            }
          } catch (e) {
            // Como o original, chat ilegível segue sem métricas de mensagem.
            // Só 401 sobe (a chave em si é inválida → cai no clássico): a chave
            // é pessoal, e um 403 aqui costuma ser só um chat a que o dono
            // não tem acesso — marcar a chave revogada rebaixaria o portal.
            if (e instanceof VibecodeAuthError && e.status === 401) throw e
            apiLogger.warn(
              {
                errorName: e instanceof Error ? e.name : 'unknown',
                // Status/code só existem nesses dois erros; nunca logar a
                // mensagem crua do axios nem headers (vazam a chave).
                status:
                  e instanceof VibecodeAuthError ||
                  e instanceof VibecodeRequestError
                    ? e.status
                    : undefined,
                code: e instanceof VibecodeRequestError ? e.code : undefined,
              },
              'Insights: chat ilegível na Vibe API, sessão sem métricas de mensagem',
            )
            // Falha passageira: não é "sem mensagens", é "não lido". O painel
            // conta essas sessões e o dia guardado fica com validade curta.
            if (isTransientChatFailure(e))
              for (const s of group) s.incomplete = true
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
      const startedAt = Date.now()
      try {
        return await this.loadDirectory()
      } finally {
        apiLogger.info(
          {
            insightsTiming: 'vibe.directory',
            portal: this.portalName,
            totalMs: Date.now() - startedAt,
          },
          'Insights: diretório lido na Vibe API',
        )
      }
    })
  }

  private async loadDirectory() {
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
    const groups: [string, number[]][] = [
      ['id', ids],
      ['contactId', contactIds],
      ['leadId', leadIds],
    ]
    // Os três grupos são independentes: em série, a latência de cada um se
    // somava (era o gargalo do painel). Cada grupo continua paginando em
    // série; o merge em ordem de grupo mantém o resultado idêntico ao serial.
    const startedAt = Date.now()
    let dealCalls = 0
    const perGroup = await Promise.all(
      groups.map(async ([field, vals]) => {
        const found: InsightsDeal[] = []
        for (let i = 0; i < vals.length; i += PAGE)
          for (let p = 0; p < MAX_LIST_PAGES; p++) {
            dealCalls += 1
            const j = await this.client.postPage<Row[]>('/deals/search', {
              filter: { [field]: { $in: vals.slice(i, i + PAGE) } },
              select: DEAL_SELECT,
              limit: PAGE,
              offset: p * PAGE,
            })
            for (const d of Array.isArray(j.data) ? j.data : [])
              found.push({
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
        return found
      }),
    )
    apiLogger.info(
      {
        insightsTiming: 'vibe.deals',
        portal: this.portalName,
        ids: ids.length,
        contactIds: contactIds.length,
        leadIds: leadIds.length,
        calls: dealCalls,
        totalMs: Date.now() - startedAt,
      },
      'Insights: negócios lidos na Vibe API',
    )
    const out = new Map<number, InsightsDeal>()
    for (const found of perGroup) for (const d of found) out.set(d.id, d)
    return [...out.values()]
  }
}
