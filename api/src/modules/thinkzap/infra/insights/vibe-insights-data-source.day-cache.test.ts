import { describe, expect, it, vi } from 'vitest'
import { makeInsightsKeys } from '@/modules/thinkzap/application/insights/insights-keys'
import {
  VibecodeAuthError,
  VibecodeRequestError,
  type VibecodeClient,
  type VibecodePage,
} from '@/modules/thinkzap/infra/clients/vibecode.client'
import { apiLogger } from '@/shared/infra/logger'
import { MemoryInsightsKv } from './memory-insights-kv'
import { KvSessionDayCache, type SessionDayCache } from './session-day-cache'
import { VibeInsightsDataSource } from './vibe-insights-data-source'

type GetPage = VibecodeClient['getPage']
type PostPage = VibecodeClient['postPage']
type Get = VibecodeClient['get']
type Body = { offset: number; dateCreateFrom: string; dateCreateTo: string }

const page = <T>(data: T, hasMore = false): VibecodePage<T> => ({
  data,
  meta: { hasMore },
})

// Relógio fixo: 18/11/2026 12:00 em Brasília.
const NOW = Date.parse('2026-11-18T15:00:00Z')
const brt = (day: string, end = false) =>
  new Date(`${day}${end ? 'T23:59:59' : 'T00:00:00'}-03:00`)

const rawSession = (over: Record<string, unknown> = {}) => ({
  id: 11,
  chatId: null,
  configId: 3,
  source: 'hubthink_thinkzap_42',
  operatorId: 7,
  userCode: 'u|1',
  dateCreate: '2026-11-10T13:00:00+00:00',
  dateClose: '2026-11-10T13:20:00+00:00',
  dateOperatorAnswer: '2026-11-10T13:02:00+00:00',
  status: 'closed',
  closeReason: 'auto',
  vote: 'like',
  crmEntityType: 'deal',
  crmEntityId: 99,
  queueTransfers: 0,
  waitAnswer: 60,
  waitClose: 1200,
  messageCount: 8,
  ...over,
})

// Uma sessão por dia (13h UTC = 10h de Brasília) entre 20/10 e 18/11.
const dailySessions = (chatId: number | null = null) =>
  Array.from({ length: 30 }, (_, d) =>
    rawSession({
      id: 100 + d,
      chatId,
      dateCreate: new Date(
        Date.parse('2026-10-20T13:00:00Z') + d * 864e5,
      ).toISOString(),
      dateClose: null,
    }),
  )

function setup(opts?: {
  rows?: () => Record<string, unknown>[]
  post?: (body: Body) => unknown
  chat?: (path: string) => unknown
  closedDayTtlMs?: number
  sleep?: (ms: number) => Promise<void>
  dayCache?: (kv: MemoryInsightsKv, clock: { t: number }) => SessionDayCache
  kv?: MemoryInsightsKv
  clock?: { t: number }
}) {
  const clock = opts?.clock ?? { t: NOW }
  const kv = opts?.kv ?? new MemoryInsightsKv(() => clock.t)
  const keys = makeInsightsKeys('bull')
  const rows = opts?.rows ?? (() => dailySessions())

  const postPage = vi.fn<PostPage>(((_path: string, body: unknown) =>
    Promise.resolve().then(() => {
      const b = body as Body
      if (opts?.post) return opts.post(b)
      const f = Date.parse(b.dateCreateFrom)
      const t = Date.parse(b.dateCreateTo)
      const found = rows().filter(s => {
        const c = Date.parse(String(s.dateCreate))
        return c >= f && c <= t
      })
      return page({
        sessions: found.slice(b.offset, b.offset + 50),
        hasNextPage: found.length > b.offset + 50,
      })
    })) as PostPage)
  const getPage = vi.fn<GetPage>(((path: string) =>
    Promise.resolve().then(() =>
      opts?.chat ? opts.chat(path) : page({ messages: [], users: [] }),
    )) as GetPage)
  const client = { postPage, getPage, get: vi.fn<Get>() } as Pick<
    VibecodeClient,
    'get' | 'getPage' | 'postPage'
  >
  const dayCache =
    opts?.dayCache?.(kv, clock) ?? new KvSessionDayCache(kv, keys, 'app-1')
  const sleep = opts?.sleep ?? vi.fn(() => Promise.resolve())
  // Cada chamada cria uma instância nova do source: simula um deploy/outro processo.
  const newSource = () =>
    new VibeInsightsDataSource(client, null, () => clock.t, {
      dayCache,
      closedDayTtlMs: opts?.closedDayTtlMs,
      chat429FinalWaitMs: 7777,
      sleep,
    })
  return { kv, keys, clock, postPage, getPage, newSource, sleep }
}

const ranges = (postPage: ReturnType<typeof setup>['postPage']) =>
  postPage.mock.calls.map(c => {
    const b = c[1] as Body
    return [b.dateCreateFrom, b.dateCreateTo]
  })

describe('VibeInsightsDataSource — cache de sessões por dia no Redis', () => {
  const a = brt('2026-11-12')
  const b = brt('2026-11-18', true)

  it('uma instância nova (deploy) não relê dias fechados; só hoje e ontem', async () => {
    const t = setup()
    await t.newSource().sessions(a, b)
    expect(t.postPage).toHaveBeenCalledTimes(1)

    // Nova instância (memória vazia), 3 min depois: hoje e ontem (TTL 2 min)
    // expiraram; os dias fechados saem do Redis.
    t.clock.t = NOW + 3 * 60e3
    await t.newSource().sessions(a, b)
    expect(ranges(t.postPage).slice(1)).toEqual([
      ['2026-11-17T03:00:00.000Z', '2026-11-19T02:59:59.999Z'],
    ])
  })

  it('alargar o período lê só os dias que ainda não estão guardados', async () => {
    const t = setup()
    await t.newSource().sessions(a, b)
    await t.newSource().sessions(brt('2026-10-20'), b)
    expect(ranges(t.postPage).slice(1)).toEqual([
      ['2026-10-20T03:00:00.000Z', '2026-11-12T02:59:59.999Z'],
    ])
  })

  it('dia fechado vale pelo TTL configurado e depois é lido de novo', async () => {
    const t = setup({ closedDayTtlMs: 3600e3 })
    const closedOnly = brt('2026-11-10', true)
    await t.newSource().sessions(brt('2026-11-10'), closedOnly)
    t.clock.t = NOW + 3599e3
    await t.newSource().sessions(brt('2026-11-10'), closedOnly)
    expect(t.postPage).toHaveBeenCalledTimes(1)

    t.clock.t = NOW + 3601e3
    await t.newSource().sessions(brt('2026-11-10'), closedOnly)
    expect(t.postPage).toHaveBeenCalledTimes(2)
  })

  it('o que sai do Redis é igual ao que a leitura direta devolveu', async () => {
    const t = setup({
      rows: () => dailySessions(500),
      chat: () =>
        page({
          users: [{ id: 900, connector: true }, { id: 7 }],
          messages: [
            { id: 1, authorId: 900, date: '2026-11-12T13:00:10Z', text: 'oi' },
            { id: 2, authorId: 7, date: '2026-11-12T13:02:10Z', text: 'olá' },
          ],
        }),
    })
    // Só dias fechados: a segunda leitura não pode chamar a API.
    const from = brt('2026-11-01')
    const to = brt('2026-11-16', true)
    const direct = await t.newSource().sessions(from, to)
    const calls = t.postPage.mock.calls.length
    const cached = await t.newSource().sessions(from, to)

    expect(t.postPage.mock.calls.length).toBe(calls)
    expect(cached).toEqual(direct)
    // Os campos de mensagem sobrevivem ao JSON (nenhum vira null/undefined).
    expect(cached.some(s => s.replyTimes.length > 0)).toBe(true)
    expect(cached.every(s => 'acceptedAt' in s && 'initiatedBy' in s)).toBe(
      true,
    )
  })

  it('leitura que falha no meio não guarda nenhum dia', async () => {
    const t = setup({
      post: body => {
        if (body.offset >= 50) throw new Error('falha na página 2')
        return page({
          sessions: Array.from({ length: 50 }, (_, i) =>
            rawSession({ id: i + 1 }),
          ),
          hasNextPage: true,
        })
      },
    })
    await expect(
      t.newSource().sessions(brt('2026-11-10'), brt('2026-11-10', true)),
    ).rejects.toThrow('falha na página 2')
    expect(await t.kv.scan('insights:*:sd:*')).toEqual([])
  })

  it('configuração salva durante a leitura: o resultado volta, mas não é guardado', async () => {
    const t = setup()
    // A "API" invalida o app no meio da leitura (como salvar a configuração).
    t.postPage.mockImplementationOnce((async (_p: string, body: unknown) => {
      await t.kv.incr(t.keys.generation('app-1'))
      const bd = body as Body
      return page({
        sessions: [rawSession({ dateCreate: bd.dateCreateFrom })],
        hasNextPage: false,
      })
    }) as PostPage)

    const out = await t
      .newSource()
      .sessions(brt('2026-11-10'), brt('2026-11-10', true))

    expect(out).toHaveLength(1)
    expect(await t.kv.scan('insights:*:sd:*')).toEqual([])
  })

  it('Redis fora do ar não derruba a leitura: relê na API e avisa', async () => {
    const warn = vi.spyOn(apiLogger, 'warn').mockImplementation(() => undefined)
    const broken: SessionDayCache = {
      read: () => Promise.reject(new Error('redis down')),
      write: () => Promise.reject(new Error('redis down')),
      generation: () => Promise.reject(new Error('redis down')),
    }
    const t = setup({ dayCache: () => broken })

    const out = await t.newSource().sessions(a, b)

    expect(out.length).toBeGreaterThan(0)
    expect(t.postPage).toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('valor corrompido no Redis é lido como dia ausente', async () => {
    const t = setup()
    await t.kv.set(t.keys.day('app-1', '2026-11-10'), '{ruim')
    const out = await t
      .newSource()
      .sessions(brt('2026-11-10'), brt('2026-11-10', true))
    expect(out).toHaveLength(1)
    expect(t.postPage).toHaveBeenCalledTimes(1)
  })

  it('dois apps não compartilham dias', async () => {
    const t = setup()
    await t.newSource().sessions(a, b)
    const other = new VibeInsightsDataSource(
      {
        postPage: t.postPage,
        getPage: t.getPage,
        get: vi.fn<Get>(),
      } as Pick<VibecodeClient, 'get' | 'getPage' | 'postPage'>,
      null,
      () => t.clock.t,
      { dayCache: new KvSessionDayCache(t.kv, t.keys, 'app-2') },
    )
    const before = t.postPage.mock.calls.length
    await other.sessions(a, b)
    expect(t.postPage.mock.calls.length).toBeGreaterThan(before)
  })
})

describe('VibeInsightsDataSource — 429 na leitura de chat', () => {
  const chatSession = () => [
    rawSession({
      id: 1,
      chatId: 500,
      dateCreate: '2026-11-10T13:00:00Z',
      dateClose: '2026-11-10T13:30:00Z',
    }),
  ]
  const day = { from: brt('2026-11-10'), to: brt('2026-11-10', true) }
  const goodChat = () =>
    page({
      users: [{ id: 900, connector: true }, { id: 7 }],
      messages: [
        { id: 2, authorId: 900, date: '2026-11-10T13:00:10Z', text: 'oi' },
        { id: 5, authorId: 7, date: '2026-11-10T13:02:10Z', text: 'olá' },
      ],
    })
  const tooMany = () => new VibecodeRequestError('429', 429, 'ERR_BAD_REQUEST')

  it('429 que passa na nova tentativa: sessão completa, sem marcar incompleta', async () => {
    let calls = 0
    const t = setup({
      rows: chatSession,
      chat: () => {
        calls += 1
        if (calls === 1) throw tooMany()
        return goodChat()
      },
    })

    const [s] = await t.newSource().sessions(day.from, day.to)

    expect(t.sleep).toHaveBeenCalledTimes(1)
    expect(t.sleep).toHaveBeenCalledWith(7777)
    expect(s).toMatchObject({ msgsClient: 1, msgsOperator: 1 })
    expect(s?.incomplete).toBeUndefined()
  })

  it('429 persistente: sessão marcada como incompleta, uma só espera', async () => {
    const warn = vi.spyOn(apiLogger, 'warn').mockImplementation(() => undefined)
    const t = setup({
      rows: chatSession,
      chat: () => {
        throw tooMany()
      },
    })

    const [s] = await t.newSource().sessions(day.from, day.to)

    expect(s?.incomplete).toBe(true)
    expect(s).toMatchObject({ msgsClient: 0, initiatedBy: null })
    expect(t.sleep).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('5xx e falha de rede também deixam a sessão incompleta', async () => {
    const warn = vi.spyOn(apiLogger, 'warn').mockImplementation(() => undefined)
    for (const status of [503, undefined]) {
      const t = setup({
        rows: chatSession,
        chat: () => {
          throw new VibecodeRequestError('falha', status)
        },
      })
      const [s] = await t.newSource().sessions(day.from, day.to)
      expect(s?.incomplete).toBe(true)
      // Só o 429 ganha a espera maior.
      expect(t.sleep).not.toHaveBeenCalled()
    }
    warn.mockRestore()
  })

  it('403 em chat (sem acesso) não marca incompleta: nunca passaria', async () => {
    const warn = vi.spyOn(apiLogger, 'warn').mockImplementation(() => undefined)
    const t = setup({
      rows: chatSession,
      chat: () => {
        throw new VibecodeAuthError(403)
      },
    })
    const [s] = await t.newSource().sessions(day.from, day.to)
    expect(s?.incomplete).toBeUndefined()
    warn.mockRestore()
  })

  it('401 em chat continua subindo (a chave é inválida)', async () => {
    const t = setup({
      rows: chatSession,
      chat: () => {
        throw new VibecodeAuthError(401)
      },
    })
    await expect(
      t.newSource().sessions(day.from, day.to),
    ).rejects.toBeInstanceOf(VibecodeAuthError)
  })

  it('dia com sessão incompleta é guardado por pouco tempo; dia completo, por muito', async () => {
    const warn = vi.spyOn(apiLogger, 'warn').mockImplementation(() => undefined)
    const t = setup({
      rows: () => [
        ...chatSession(),
        rawSession({
          id: 2,
          chatId: null,
          dateCreate: '2026-11-11T13:00:00Z',
          dateClose: null,
        }),
      ],
      chat: () => {
        throw tooMany()
      },
    })
    const from = brt('2026-11-10')
    const to = brt('2026-11-11', true)
    await t.newSource().sessions(from, to)
    expect(t.postPage).toHaveBeenCalledTimes(1)

    // 3 min depois: o dia 10 (incompleto) expirou; o dia 11 (completo) não.
    t.clock.t = NOW + 3 * 60e3
    await t.newSource().sessions(from, to)
    expect(ranges(t.postPage).slice(1)).toEqual([
      ['2026-11-10T03:00:00.000Z', '2026-11-11T02:59:59.999Z'],
    ])
    warn.mockRestore()
  })
})
