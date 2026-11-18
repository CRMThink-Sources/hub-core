import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InsightsSettings } from '../domain/repositories/insights-settings/insights-settings.repository'

const KEY = 'vibe_SEGREDO_decifrado_9876'

const h = vi.hoisted(() => ({
  getSettings: vi.fn(),
  axiosGet: vi.fn(),
  axiosPost: vi.fn(),
  axiosCreate: vi.fn(),
}))

vi.mock('axios', () => {
  const instance = { get: h.axiosGet, post: h.axiosPost }
  h.axiosCreate.mockImplementation(() => instance)
  return {
    default: {
      create: h.axiosCreate,
      isAxiosError: (e: unknown) =>
        typeof e === 'object' && e !== null && 'isAxiosError' in e,
    },
  }
})
vi.mock('@/shared/infra/crypto/token-cipher', () => ({
  decryptToken: (v: string) => (v === 'enc' ? KEY : `${KEY}-${v}`),
}))
vi.mock(
  '../infra/persistence/repositories/prisma-insights-settings.repository',
  () => ({
    PrismaInsightsSettingsRepository: class {
      get = h.getSettings
    },
  }),
)
vi.mock(
  '@/shared/infra/persistence/repositories/prisma-installed-app.repository',
  () => ({
    PrismaInstalledAppRepository: class {
      getById = vi.fn(() => Promise.resolve({ id: 'x', domainId: 'd' }))
    },
  }),
)
vi.mock(
  '@/shared/infra/persistence/repositories/prisma-domain.repository',
  () => ({
    PrismaDomainRepository: class {
      getDomainById = vi.fn(() =>
        Promise.resolve({ name: 'p.bitrix24.com.br' }),
      )
    },
  }),
)
vi.mock(
  '@/shared/infra/persistence/repositories/prisma-credential.repository',
  () => ({ PrismaCredentialRepository: class {} }),
)
// O clássico de verdade chamaria o Bitrix; aqui só importa que ele foi o usado.
vi.mock('../infra/insights/classic-insights-data-source', async orig => ({
  ...(await orig<object>()),
  ClassicInsightsDataSource: class {
    readonly mode = 'lean'
    constructor(
      _client: unknown,
      readonly portal: string,
    ) {}
    sessions = () => Promise.resolve([])
    directory = () => Promise.resolve({ users: {}, userDept: {} })
    operators = () => Promise.resolve([])
    deals = () => Promise.resolve([])
  },
}))

import { INSIGHTS_CONFIG_DEFAULT } from '../domain/insights-config'
import { GetInsightsDashboard } from '../application/insights/get-insights-dashboard'
import { GetInsightsToday } from '../application/insights/get-insights-today'
import type { GetInsightsConfig } from '../application/insights/get-insights-config'
import { InsightsResultCache } from '../application/insights/insights-result-cache'
import {
  clearKeyProblem,
  getKeyProblem,
} from '../application/insights/key-health'
import { VibeInsightsDataSource } from '../infra/insights/vibe-insights-data-source'
import { apiLogger } from '@/shared/infra/logger'
import { makeInsightsSourceResolver } from './make-insights-source-resolver'

const settings = (keyEnc: string | null): InsightsSettings => ({
  keyEnc,
  last4: keyEnc ? '9876' : null,
  portalId: null,
  validatedAt: null,
  config: null,
})

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } })
// Como o erro do axios: a mensagem e os headers carregam a chave.
const httpFail = (status: number) =>
  Promise.reject(
    Object.assign(new Error(`falhou com header ${KEY}`), {
      isAxiosError: true,
      response: { status },
      config: { headers: { 'X-Api-Key': KEY } },
    }),
  )

const getConfig = {
  execute: vi.fn<GetInsightsConfig['execute']>(() =>
    Promise.resolve(INSIGHTS_CONFIG_DEFAULT),
  ),
}

describe('makeInsightsSourceResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    clearKeyProblem('app-1')
    h.getSettings.mockResolvedValue(settings(null))
    h.axiosGet.mockImplementation((path: string) =>
      path === '/me' ? ok({ portal: 'cliente.bitrix24.com.br' }) : ok([]),
    )
    h.axiosPost.mockImplementation(() =>
      ok({ sessions: [], hasNextPage: false }),
    )
  })

  it('reusa a mesma fonte lean por app, inclusive em chamadas simultâneas', async () => {
    const { resolve } = makeInsightsSourceResolver()
    const [a, b] = await Promise.all([resolve('app-1'), resolve('app-1')])
    const c = await resolve('app-1')
    const other = await resolve('app-2')
    expect(a).toBe(b)
    expect(a).toBe(c)
    expect(other).not.toBe(a)
    expect(a.mode).toBe('lean')
    expect(a.portal).toBe('p.bitrix24.com.br')
  })

  it('com chave guardada usa a Vibe API com a chave decifrada', async () => {
    h.getSettings.mockResolvedValue(settings('enc'))
    const { resolve } = makeInsightsSourceResolver()
    const source = await resolve('app-1')
    expect(source).toBeInstanceOf(VibeInsightsDataSource)
    expect(source.mode).toBe('full')
    expect(source.portal).toBe('cliente.bitrix24.com.br')
    expect(h.axiosCreate).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { 'X-Api-Key': KEY } }),
    )
    expect(await resolve('app-1')).toBe(source)
  })

  it('trocar ou remover a chave invalida a fonte guardada', async () => {
    h.getSettings.mockResolvedValue(settings('enc'))
    const { resolve, invalidate } = makeInsightsSourceResolver()
    const vibe = await resolve('app-1')

    h.getSettings.mockResolvedValue(settings(null))
    // Sem invalidar, segue a fonte guardada (uma por app).
    expect(await resolve('app-1')).toBe(vibe)
    invalidate('app-1')
    const lean = await resolve('app-1')
    expect(lean.mode).toBe('lean')

    h.getSettings.mockResolvedValue(settings('outra'))
    invalidate('app-1')
    const again = await resolve('app-1')
    expect(again.mode).toBe('full')
    expect(again).not.toBe(vibe)
  })

  it('invalidar no meio de uma montagem não guarda a fonte antiga', async () => {
    h.getSettings.mockResolvedValue(settings('enc'))
    const { resolve, invalidate } = makeInsightsSourceResolver()
    const building = resolve('app-1')
    h.getSettings.mockResolvedValue(settings(null))
    invalidate('app-1')
    await building
    expect((await resolve('app-1')).mode).toBe('lean')
  })

  it('invalidar também limpa o cache de resultados do painel', () => {
    const cache = new InsightsResultCache()
    const spy = vi.spyOn(cache, 'invalidate')
    const { invalidate } = makeInsightsSourceResolver({ resultCache: cache })
    invalidate('app-1')
    expect(spy).toHaveBeenCalledWith('app-1')
  })

  it('chave revogada: usa o clássico e marca keyProblem', async () => {
    h.getSettings.mockResolvedValue(settings('enc'))
    h.axiosPost.mockImplementation(() => httpFail(401))
    const { resolve, onSourceFailure } = makeInsightsSourceResolver()
    const deps = {
      getConfig,
      resolveSource: resolve,
      onSourceFailure,
      cache: new InsightsResultCache(),
    }

    const dash = await new GetInsightsDashboard(deps).execute('app-1', {})
    expect(dash.mode).toBe('lean')
    expect(getKeyProblem('app-1')).toBe('revoked')
    // A fonte Vibe guardada caiu: as próximas leituras já vão pelo clássico.
    expect((await resolve('app-1')).mode).toBe('lean')

    const today = await new GetInsightsToday(deps).execute('app-1', {})
    expect(today.mode).toBe('lean')
  })

  it('403 também conta como chave revogada', async () => {
    h.getSettings.mockResolvedValue(settings('enc'))
    h.axiosPost.mockImplementation(() => httpFail(403))
    const { resolve, onSourceFailure } = makeInsightsSourceResolver()
    const r = await new GetInsightsDashboard({
      getConfig,
      resolveSource: resolve,
      onSourceFailure,
      cache: new InsightsResultCache(),
    }).execute('app-1', {})
    expect(r.mode).toBe('lean')
    expect(getKeyProblem('app-1')).toBe('revoked')
  })

  it('403 em um chat não marca a chave como revogada', async () => {
    h.getSettings.mockResolvedValue(settings('enc'))
    h.axiosPost.mockImplementation(() =>
      ok({
        sessions: [{ id: 1, chatId: 500, dateCreate: '2026-11-10T13:00:00Z' }],
        hasNextPage: false,
      }),
    )
    h.axiosGet.mockImplementation((path: string) =>
      path.startsWith('/chats/') ? httpFail(403) : ok([]),
    )
    const { resolve, onSourceFailure } = makeInsightsSourceResolver()
    const r = await new GetInsightsDashboard({
      getConfig,
      resolveSource: resolve,
      onSourceFailure,
      cache: new InsightsResultCache(),
    }).execute('app-1', { from: '2026-11-01', to: '2026-11-30' })
    expect(r.mode).toBe('full')
    expect(getKeyProblem('app-1')).toBeNull()
  })

  it('401 em um chat ainda marca a chave como revogada', async () => {
    h.getSettings.mockResolvedValue(settings('enc'))
    h.axiosPost.mockImplementation(() =>
      ok({
        sessions: [{ id: 1, chatId: 500, dateCreate: '2026-11-10T13:00:00Z' }],
        hasNextPage: false,
      }),
    )
    h.axiosGet.mockImplementation((path: string) =>
      path.startsWith('/chats/') ? httpFail(401) : ok([]),
    )
    const { resolve, onSourceFailure } = makeInsightsSourceResolver()
    const r = await new GetInsightsDashboard({
      getConfig,
      resolveSource: resolve,
      onSourceFailure,
      cache: new InsightsResultCache(),
    }).execute('app-1', { from: '2026-11-01', to: '2026-11-30' })
    expect(r.mode).toBe('lean')
    expect(getKeyProblem('app-1')).toBe('revoked')
  })

  it('5xx da Vibecode não marca a chave como revogada', async () => {
    h.getSettings.mockResolvedValue(settings('enc'))
    h.axiosPost.mockImplementation(() => httpFail(503))
    const { resolve, onSourceFailure } = makeInsightsSourceResolver()
    const vibe = await resolve('app-1')

    await expect(
      new GetInsightsDashboard({
        getConfig,
        resolveSource: resolve,
        onSourceFailure,
        cache: new InsightsResultCache(),
      }).execute('app-1', {}),
    ).rejects.toThrow('Falha ao chamar a Vibecode (503)')
    expect(getKeyProblem('app-1')).toBeNull()
    expect(await resolve('app-1')).toBe(vibe)
  })

  it('a chave decifrada nunca aparece em log nem em erro', async () => {
    h.getSettings.mockResolvedValue(settings('enc'))
    const logged: unknown[] = []
    for (const level of ['info', 'warn', 'error', 'debug'] as const)
      vi.spyOn(apiLogger, level).mockImplementation(((...a: unknown[]) => {
        logged.push(a)
      }) as never)
    const { resolve, onSourceFailure } = makeInsightsSourceResolver()
    const uc = new GetInsightsDashboard({
      getConfig,
      resolveSource: resolve,
      onSourceFailure,
      cache: new InsightsResultCache(),
    })

    h.axiosGet.mockImplementation(() => httpFail(500))
    h.axiosPost.mockImplementation(() => httpFail(500))
    const err5xx = await uc.execute('app-1', {}).catch((e: unknown) => e)

    h.axiosPost.mockImplementation(() => httpFail(401))
    await uc.execute('app-1', {})

    const dump = (v: unknown) =>
      JSON.stringify(v, (_k, x: unknown) =>
        x instanceof Error
          ? { ...x, name: x.name, message: x.message, stack: x.stack }
          : x,
      )
    expect(err5xx).toBeInstanceOf(Error)
    expect(dump(err5xx)).not.toContain(KEY)
    expect(dump(logged)).not.toContain(KEY)
  })
})
