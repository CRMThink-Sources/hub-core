import { describe, expect, it, vi } from 'vitest'
import {
  VibecodeAuthError,
  VibecodeRequestError,
  type VibecodeClient,
  type VibecodePage,
} from '@/modules/thinkzap/infra/clients/vibecode.client'
import { apiLogger } from '@/shared/infra/logger'
import { VibeInsightsDataSource } from './vibe-insights-data-source'

type GetPage = VibecodeClient['getPage']
type PostPage = VibecodeClient['postPage']
type Get = VibecodeClient['get']

const page = <T>(data: T, hasMore = false): VibecodePage<T> => ({
  data,
  meta: { hasMore },
})

const rawSession = (over: Record<string, unknown> = {}) => ({
  id: 11,
  chatId: 500,
  configId: 3,
  source: 'hubthink_thinkzap_42',
  operatorId: 7,
  userCode: 'hubthink_thinkzap_42|1|5511999|500',
  dateCreate: '2026-11-10T13:00:00+00:00',
  dateClose: '2026-11-10T13:20:00+00:00',
  dateOperatorAnswer: '2026-11-10T13:02:00+00:00',
  status: 'closed',
  closeReason: 'auto',
  vote: 'like',
  crmEntityType: 'deal',
  crmEntityId: 99,
  queueTransfers: 2,
  waitAnswer: 60,
  waitClose: 1200,
  messageCount: 8,
  ...over,
})

const from = new Date('2026-11-01T00:00:00Z')
const to = new Date('2026-11-30T00:00:00Z')

/**
 * Cliente falso: `getPage`/`postPage` respondem por rota; `get` reaproveita o
 * mesmo roteador (como o cliente real, que desembrulha o `data`).
 */
type Body = {
  filter: Record<string, unknown>
  offset: number
  select: string[]
}

function make(routes: {
  get?: (path: string) => unknown
  post?: (path: string, body: Body) => unknown
}) {
  const call = (run: () => unknown) => Promise.resolve().then(run)
  const getPage = vi.fn<GetPage>(((path: string) =>
    call(() => {
      if (!routes.get) throw new Error(`rota inesperada: ${path}`)
      return routes.get(path)
    })) as GetPage)
  const postPage = vi.fn<PostPage>(((path: string, body: unknown) =>
    call(() => {
      if (!routes.post) throw new Error(`rota inesperada: ${path}`)
      return routes.post(path, body as Body)
    })) as PostPage)
  const get = vi.fn<Get>(((path: string) =>
    getPage(path).then(p => p.data)) as Get)
  // O mock perde o genérico de `get<T>`; o contrato segue o do cliente real.
  const client = { getPage, postPage, get } as Pick<
    VibecodeClient,
    'get' | 'getPage' | 'postPage'
  >
  return {
    getPage,
    postPage,
    ds: new VibeInsightsDataSource(client, 'fallback.bitrix24.com.br'),
  }
}

const chatEmpty = (path: string) =>
  path.startsWith('/chats/')
    ? page({ messages: [], users: [] })
    : (() => {
        throw new Error(`rota inesperada: ${path}`)
      })()

describe('VibeInsightsDataSource', () => {
  it('mapeia sessão com closeReason, vote e spam', async () => {
    const { ds } = make({
      post: () =>
        page({
          sessions: [
            rawSession(),
            rawSession({
              id: 12,
              status: 'spam',
              closeReason: null,
              vote: null,
              userCode: '',
              userId: 321,
              dateOperatorAnswer: null,
            }),
          ],
          hasNextPage: false,
        }),
      get: chatEmpty,
    })

    const [a, b] = await ds.sessions(from, to)

    expect(ds.mode).toBe('full')
    expect(a).toEqual({
      id: 11,
      configId: 3,
      source: 'hubthink_thinkzap_42',
      line: null,
      operatorId: 7,
      userCode: 'hubthink_thinkzap_42|1|5511999|500',
      chatId: 500,
      dateCreate: '2026-11-10T13:00:00+00:00',
      dateClose: '2026-11-10T13:20:00+00:00',
      dateOperatorAnswer: '2026-11-10T13:02:00+00:00',
      status: 'closed',
      closeReason: 'auto',
      vote: 'like',
      crmEntityType: 'deal',
      crmEntityId: 99,
      queueTransfers: 2,
      waitAnswer: 60,
      waitClose: 1200,
      messageCount: 8,
      initiatedBy: null,
      msgsOperator: 0,
      msgsClient: 0,
      msgsBot: 0,
      replyTimes: [],
      clientReplied: null,
      firstOperatorAt: null,
      firstClientAt: null,
      lastOperatorAt: null,
      acceptedAt: null,
    })
    expect(b).toMatchObject({
      id: 12,
      status: 'spam',
      closeReason: null,
      vote: 'none',
      // Recorrência agrupa por userCode; sem ele, o original usava o userId.
      userCode: '321',
      dateOperatorAnswer: null,
    })
  })

  it('userCode nunca fica vazio e datas/números inválidos não viram NaN', async () => {
    const { ds } = make({
      post: () =>
        page({
          sessions: [
            rawSession({
              id: 20,
              userCode: null,
              userId: null,
              chatId: null,
              waitAnswer: 'x',
              waitClose: undefined,
              queueTransfers: null,
              dateClose: 'não é data',
              dateOperatorAnswer: 'lixo',
            }),
            rawSession({ id: 21, dateCreate: 'inválida' }),
          ],
          hasNextPage: false,
        }),
    })

    const list = await ds.sessions(from, to)

    // Sem data de criação válida a sessão não cabe em período nenhum.
    expect(list.map(s => s.id)).toEqual([20])
    expect(list[0]).toMatchObject({
      userCode: 's20',
      chatId: null,
      waitAnswer: null,
      waitClose: null,
      queueTransfers: 0,
      dateClose: null,
      dateOperatorAnswer: null,
    })
  })

  it('pagina sessões de 50 em 50', async () => {
    const bodies: Body[] = []
    const { ds } = make({
      post: (path, body) => {
        expect(path).toBe('/openlines/sessions/search')
        bodies.push(body)
        return page({
          sessions: [rawSession({ id: bodies.length, chatId: null })],
          hasNextPage: bodies.length < 3,
        })
      },
    })

    const list = await ds.sessions(from, to)

    expect(list.map(s => s.id)).toEqual([1, 2, 3])
    expect(bodies).toEqual(
      [0, 50, 100].map(offset => ({
        // Os dias das pontas são lidos inteiros (dia de Brasília).
        dateCreateFrom: '2026-10-31T03:00:00.000Z',
        dateCreateTo: '2026-11-30T02:59:59.999Z',
        limit: 50,
        offset,
        order: 'dateCreate',
        orderDirection: 'asc',
      })),
    )
  })

  it('lê mensagens do chat para métricas', async () => {
    const paths: string[] = []
    const { ds } = make({
      post: () =>
        page({
          sessions: [
            rawSession({
              id: 1,
              chatId: 500,
              dateCreate: '2026-11-10T13:00:00Z',
              dateClose: '2026-11-10T13:30:00Z',
            }),
          ],
          hasNextPage: false,
        }),
      get: path => {
        paths.push(path)
        return page({
          users: [
            { id: 900, connector: true },
            { id: 7 },
            { id: 8, type: 'bot' },
          ],
          messages: [
            // Mensagem de outra sessão do mesmo chat (antes da janela).
            { id: 1, authorId: 900, date: '2026-11-09T10:00:00Z', text: 'x' },
            { id: 2, authorId: 900, date: '2026-11-10T13:00:10Z', text: 'oi' },
            { id: 3, authorId: 8, date: '2026-11-10T13:00:20Z', text: 'bot' },
            {
              id: 4,
              authorId: 0,
              date: '2026-11-10T13:01:00Z',
              text: 'Ana aceitou a conversa',
            },
            { id: 5, authorId: 7, date: '2026-11-10T13:02:10Z', text: 'olá' },
            { id: 6, authorId: 900, date: 'data ruim', text: '?' },
          ],
        })
      },
    })

    const [s] = await ds.sessions(from, to)

    // O histórico por sessão só traz a última do chat: lê o chat inteiro.
    expect(paths).toEqual(['/chats/chat500/messages?limit=50'])
    expect(s).toMatchObject({
      initiatedBy: 'client',
      msgsClient: 1,
      msgsOperator: 1,
      msgsBot: 1,
      replyTimes: [120],
      firstClientAt: '2026-11-10T13:00:10Z',
      firstOperatorAt: '2026-11-10T13:02:10Z',
      lastOperatorAt: '2026-11-10T13:02:10Z',
      acceptedAt: '2026-11-10T13:01:00Z',
      // Campos gravados pelo Bitrix continuam vindo da sessão.
      waitAnswer: 60,
      messageCount: 8,
    })
  })

  it('pagina as mensagens do chat por lastId até passar do início', async () => {
    const paths: string[] = []
    const full = (base: number, date: string) =>
      Array.from({ length: 50 }, (_, i) => ({
        id: base + i,
        authorId: 7,
        date,
        text: 'x',
      }))
    const { ds } = make({
      post: () =>
        page({
          sessions: [
            rawSession({ chatId: 9, dateCreate: '2026-11-10T13:00:00Z' }),
          ],
          hasNextPage: false,
        }),
      get: path => {
        paths.push(path)
        const msgs =
          paths.length === 1
            ? full(100, '2026-11-10T14:00:00Z')
            : full(50, '2026-11-01T00:00:00Z')
        return page({ users: [], messages: msgs })
      },
    })

    await ds.sessions(from, to)

    expect(paths).toEqual([
      '/chats/chat9/messages?limit=50',
      '/chats/chat9/messages?limit=50&lastId=100',
    ])
  })

  it('falha não-auth ao ler o chat não derruba o painel', async () => {
    const { ds } = make({
      post: () => page({ sessions: [rawSession()], hasNextPage: false }),
      get: () => {
        throw new VibecodeRequestError('Falha ao chamar a Vibecode (500)')
      },
    })

    const [s] = await ds.sessions(from, to)

    expect(s).toMatchObject({ id: 11, msgsClient: 0, initiatedBy: null })
  })

  it('loga status e code do VibecodeRequestError no chat ilegível', async () => {
    const warn = vi.spyOn(apiLogger, 'warn').mockImplementation(() => undefined)
    const { ds } = make({
      post: () => page({ sessions: [rawSession()], hasNextPage: false }),
      get: () => {
        throw new VibecodeRequestError(
          'Falha ao chamar a Vibecode (sem resposta)',
          undefined,
          'ECONNABORTED',
        )
      },
    })

    await ds.sessions(from, to)

    expect(warn).toHaveBeenCalledWith(
      {
        errorName: 'VibecodeRequestError',
        status: undefined,
        code: 'ECONNABORTED',
      },
      expect.stringContaining('chat ilegível'),
    )
    warn.mockRestore()
  })

  it('403 em um chat não marca a chave como revogada', async () => {
    const { ds } = make({
      post: () =>
        page({
          sessions: [
            rawSession({ id: 1, chatId: 500 }),
            rawSession({ id: 2, chatId: 600 }),
          ],
          hasNextPage: false,
        }),
      get: path => {
        // Chave pessoal sem acesso a um chat: só esse chat fica sem métricas.
        if (path.startsWith('/chats/chat500/')) throw new VibecodeAuthError(403)
        if (path.startsWith('/chats/chat600/'))
          return page({
            users: [{ id: 900, connector: true }],
            messages: [
              { id: 1, authorId: 900, date: '2026-11-10T13:00:10+00:00' },
            ],
          })
        if (path === '/openlines/operators')
          return page({
            operators: [{ userId: 7, configId: 3, status: 'online' }],
          })
        throw new Error(path)
      },
    })

    const [a, b] = await ds.sessions(from, to)

    expect(a).toMatchObject({
      id: 1,
      status: 'closed',
      vote: 'like',
      waitAnswer: 60,
      initiatedBy: null,
      msgsClient: 0,
      msgsOperator: 0,
      replyTimes: [],
    })
    expect(b).toMatchObject({ id: 2, initiatedBy: 'client', msgsClient: 1 })
    await expect(ds.operators()).resolves.toHaveLength(1)
  })

  it('401 em um chat ainda marca a chave como revogada', async () => {
    const { ds } = make({
      post: () => page({ sessions: [rawSession()], hasNextPage: false }),
      get: () => {
        throw new VibecodeAuthError(401)
      },
    })

    const err = await ds.sessions(from, to).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(VibecodeAuthError)
    expect((err as VibecodeAuthError).status).toBe(401)
  })

  it('reaproveita a leitura do mesmo período (cache curto)', async () => {
    const { ds, postPage } = make({
      post: () => page({ sessions: [], hasNextPage: false }),
    })
    await Promise.all([ds.sessions(from, to), ds.sessions(from, to)])
    await ds.sessions(from, to)
    expect(postPage).toHaveBeenCalledTimes(1)
  })

  it('não guarda leitura que falhou', async () => {
    let fail = true
    const { ds } = make({
      post: () => {
        if (fail) throw new VibecodeRequestError('Falha (500)')
        return page({ sessions: [], hasNextPage: false })
      },
    })
    await expect(ds.sessions(from, to)).rejects.toThrow()
    fail = false
    await expect(ds.sessions(from, to)).resolves.toEqual([])
  })

  describe('cache de sessões por dia de Brasília', () => {
    // Relógio fixo: 18/11/2026 12:00 em Brasília.
    const NOW = Date.parse('2026-11-18T15:00:00Z')
    const brt = (day: string, end = false) =>
      new Date(`${day}${end ? 'T23:59:59' : 'T00:00:00'}-03:00`)

    // Uma sessão por dia (às 10h de Brasília) entre 20/10 e 18/11, e uma às
    // 23h30 de 14/11 que em UTC já cai em 15/11 (prova o corte por Brasília).
    const fakeSessions = () => {
      const out: Record<string, unknown>[] = []
      for (let d = 0; d < 30; d++) {
        const at = Date.parse('2026-10-20T13:00:00Z') + d * 864e5
        out.push(
          rawSession({
            id: 100 + d,
            chatId: null,
            dateCreate: new Date(at).toISOString(),
            dateClose: null,
          }),
        )
      }
      out.push(
        rawSession({
          id: 999,
          chatId: null,
          dateCreate: '2026-11-15T02:30:00.000Z',
          dateClose: null,
        }),
      )
      return out.sort((a, b) =>
        String(a.dateCreate).localeCompare(String(b.dateCreate)),
      )
    }

    // Imita o filtro de datas e a paginação da API.
    const apiRoutes = () => ({
      post: (_path: string, body: Body) => {
        const b = body as unknown as {
          dateCreateFrom: string
          dateCreateTo: string
        }
        const f = Date.parse(b.dateCreateFrom)
        const t = Date.parse(b.dateCreateTo)
        const rows = fakeSessions().filter(s => {
          const c = Date.parse(String(s.dateCreate))
          return c >= f && c <= t
        })
        return page({
          sessions: rows.slice(body.offset, body.offset + 50),
          hasNextPage: rows.length > body.offset + 50,
        })
      },
    })

    const makeAt = (clock: { t: number }) => {
      const postPage = vi.fn<PostPage>(((path: string, body: unknown) =>
        Promise.resolve().then(() =>
          apiRoutes().post(path, body as Body),
        )) as PostPage)
      const getPage = vi.fn<GetPage>()
      const get = vi.fn<Get>()
      const client = { getPage, postPage, get } as Pick<
        VibecodeClient,
        'get' | 'getPage' | 'postPage'
      >
      return {
        postPage,
        ds: new VibeInsightsDataSource(client, null, () => clock.t),
      }
    }

    const ranges = (postPage: ReturnType<typeof makeAt>['postPage']) =>
      postPage.mock.calls.map(c => {
        const b = c[1] as { dateCreateFrom: string; dateCreateTo: string }
        return [b.dateCreateFrom, b.dateCreateTo]
      })

    it('7 dias e depois 30 dias só buscam a faixa que falta', async () => {
      const { ds, postPage } = makeAt({ t: NOW })
      const to = brt('2026-11-18', true)

      await ds.sessions(brt('2026-11-12'), to)
      await ds.sessions(brt('2026-10-20'), to)

      expect(ranges(postPage)).toEqual([
        ['2026-11-12T03:00:00.000Z', '2026-11-19T02:59:59.999Z'],
        ['2026-10-20T03:00:00.000Z', '2026-11-12T02:59:59.999Z'],
      ])
    })

    it('pedidos simultâneos não duplicam chamadas', async () => {
      const { ds, postPage } = makeAt({ t: NOW })
      const a = brt('2026-11-12')
      const b = brt('2026-11-18', true)

      const [x, y] = await Promise.all([ds.sessions(a, b), ds.sessions(a, b)])

      expect(postPage).toHaveBeenCalledTimes(1)
      expect(x.map(s => s.id)).toEqual(y.map(s => s.id))
    })

    it('dias passados duram 30 min; hoje e ontem, 2 min', async () => {
      const clock = { t: NOW }
      const { ds, postPage } = makeAt(clock)
      const a = brt('2026-11-10')
      const b = brt('2026-11-18', true)
      await ds.sessions(a, b)
      expect(postPage).toHaveBeenCalledTimes(1)

      // 3 min depois: só ontem (17) e hoje (18) expiraram.
      clock.t = NOW + 3 * 60e3
      await ds.sessions(a, b)
      expect(ranges(postPage).slice(1)).toEqual([
        ['2026-11-17T03:00:00.000Z', '2026-11-19T02:59:59.999Z'],
      ])

      // 31 min depois da primeira leitura: os dias passados também expiraram.
      clock.t = NOW + 31 * 60e3
      await ds.sessions(a, b)
      expect(ranges(postPage).slice(2)).toEqual([
        ['2026-11-10T03:00:00.000Z', '2026-11-19T02:59:59.999Z'],
      ])
    })

    it('a união devolvida é idêntica à de uma leitura única', async () => {
      const clock = { t: NOW }
      const a = brt('2026-10-20')
      const b = brt('2026-11-18', true)
      const piecewise = makeAt(clock)
      await piecewise.ds.sessions(brt('2026-11-12'), b)
      await piecewise.ds.sessions(brt('2026-11-01'), brt('2026-11-13', true))
      const merged = await piecewise.ds.sessions(a, b)

      const single = await makeAt(clock).ds.sessions(a, b)

      expect(merged).toEqual(single)
      const ids = merged.map(s => s.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).toContain(999)
    })

    it('corta no [from, to] exato mesmo lendo o dia inteiro', async () => {
      const { ds } = makeAt({ t: NOW })
      // Fora do recorte ficam a das 10h de 14/11 (antes) e a das 10h de 15/11
      // (depois); só a das 23h30 de 14/11 (id 999) cabe.
      const list = await ds.sessions(
        new Date('2026-11-14T12:00:00-03:00'),
        new Date('2026-11-15T09:00:00-03:00'),
      )
      expect(list.map(s => s.id)).toEqual([999])
    })

    it('falha na API não fica presa no cache', async () => {
      const clock = { t: NOW }
      const { ds, postPage } = makeAt(clock)
      const a = brt('2026-11-12')
      const b = brt('2026-11-18', true)
      postPage.mockRejectedValueOnce(new VibecodeRequestError('Falha (500)'))

      await expect(ds.sessions(a, b)).rejects.toThrow()
      await expect(ds.sessions(a, b)).resolves.not.toHaveLength(0)
      expect(postPage).toHaveBeenCalledTimes(2)
    })
  })

  it('monta o diretório com setor mais específico, paginado', async () => {
    const paths: string[] = []
    const { ds } = make({
      get: path => {
        paths.push(path)
        if (path.startsWith('/departments?limit=50&offset=0'))
          return page(
            [
              { id: 1, name: ' Empresa ', parentId: null },
              { id: 2, name: 'Vendas', parentId: 1 },
            ],
            true,
          )
        if (path.startsWith('/departments'))
          return page([{ id: 3, name: 'SDR', parentId: 2 }])
        if (path.includes('offset=0'))
          return page(
            [{ id: 7, name: 'Ana', lastName: 'Lima', departmentId: [1, 3] }],
            true,
          )
        return page([{ id: 8, name: 'Bia', departmentId: [99] }])
      },
    })

    const dir = await ds.directory()

    expect(paths).toEqual([
      '/departments?limit=50&offset=0',
      '/departments?limit=50&offset=50',
      '/users?limit=50&offset=0&select=id,name,lastName,departmentId',
      '/users?limit=50&offset=50&select=id,name,lastName,departmentId',
    ])
    expect(dir).toEqual({
      users: { '7': 'Ana Lima', '8': 'Bia' },
      userDept: {
        '7': { id: 3, name: 'SDR' },
        '8': { id: 0, name: 'Sem setor' },
      },
    })
  })

  it('lê operadores ao vivo e metas dos canais', async () => {
    const { ds } = make({
      get: path => {
        if (path === '/openlines/operators')
          return page({
            operators: [
              {
                userId: '7',
                configId: '3',
                status: 'online',
                activeSessions: 2,
              },
            ],
          })
        if (path === '/openline-configs')
          return page([{ id: 3, name: 'WhatsApp', kpiFirstAnswerTime: 300 }])
        throw new Error(path)
      },
    })

    await expect(ds.operators()).resolves.toEqual([
      { userId: 7, configId: 3, status: 'online', activeSessions: 2 },
    ])
    await expect(ds.channelConfigs()).resolves.toEqual([
      { id: 3, name: 'WhatsApp', kpiFirstAnswerTime: 300 },
    ])
  })

  it('portal vem do /me; sem /me fica o domínio da instalação', async () => {
    const ok = make({
      get: () => page({ portal: 'cliente.bitrix24.com.br' }),
    })
    expect(ok.ds.portal).toBe('fallback.bitrix24.com.br')
    await ok.ds.loadPortal()
    expect(ok.ds.portal).toBe('cliente.bitrix24.com.br')

    const ko = make({
      get: () => {
        throw new VibecodeRequestError('Falha (500)')
      },
    })
    await ko.ds.loadPortal()
    expect(ko.ds.portal).toBe('fallback.bitrix24.com.br')
  })

  it('dispara os três grupos de negócios antes de qualquer resposta e deduplica', async () => {
    const started: string[] = []
    const releases: (() => void)[] = []
    const deal = (over: Record<string, unknown> = {}) => ({
      id: 7,
      title: 'N7',
      stageSemanticId: 'S',
      amount: 1,
      currency: 'BRL',
      createdAt: '2026-11-10T10:00:00Z',
      contactId: null,
      leadId: null,
      ...over,
    })
    const { ds } = make({
      post: (_path, body) => {
        started.push(Object.keys(body.filter)[0] ?? '')
        return new Promise(resolve => {
          releases.push(() => resolve(page([deal()])))
        })
      },
    })

    const result = ds.deals([7], [8], [9])
    await new Promise(resolve => setTimeout(resolve, 0))

    // Nenhuma resposta liberada ainda e os três já saíram.
    expect(started).toEqual(['id', 'contactId', 'leadId'])
    releases.forEach(release => release())

    // O mesmo id vindo dos três grupos aparece uma vez.
    await expect(result).resolves.toEqual([deal()])
  })

  it('busca negócios por id, contato e lead, paginado de 50 em 50', async () => {
    const bodies: Body[] = []
    const { ds } = make({
      post: (path, body) => {
        expect(path).toBe('/deals/search')
        bodies.push(body)
        if (body.filter.id && body.offset === 0)
          return page(
            [
              {
                id: 1,
                title: 'N1',
                stageSemanticId: 'S',
                amount: '150.5',
                currency: 'BRL',
                createdAt: '2026-11-10T10:00:00Z',
                contactId: 4,
                leadId: null,
              },
            ],
            true,
          )
        return page([])
      },
    })

    const deals = await ds.deals([1], [4], [])

    // Grupos rodam em paralelo: a ordem entre grupos não é garantida.
    expect(bodies).toHaveLength(3)
    expect(bodies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filter: { id: { $in: [1] } },
          limit: 50,
          offset: 0,
        }),
        expect.objectContaining({ filter: { id: { $in: [1] } }, offset: 50 }),
        expect.objectContaining({
          filter: { contactId: { $in: [4] } },
          offset: 0,
        }),
      ]),
    )
    expect(bodies[0]?.select).toEqual([
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
    ])
    expect(deals).toEqual([
      {
        id: 1,
        title: 'N1',
        stageSemanticId: 'S',
        amount: 150.5,
        currency: 'BRL',
        createdAt: '2026-11-10T10:00:00Z',
        contactId: 4,
        leadId: null,
      },
    ])
  })
})
