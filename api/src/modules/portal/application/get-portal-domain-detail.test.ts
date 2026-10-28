import { describe, expect, it, vi } from 'vitest'
import { GetPortalDomainDetail } from './get-portal-domain-detail'
import type { PortalDomainReadRepository } from '../domain/repositories/portal-domain-read.repository'
import { PortalDomainNotFoundError } from '../domain/errors/portal-domain.errors'

const app = (id: string, spaId: string | null) => ({
  id,
  appCodeId: 'crmthink.thinkzap',
  appCode: 'thinkzap',
  appName: 'ThinkZap',
  title: 'ThinkZap',
  spaId,
  mirror: spaId === null ? ('no-mirror' as const) : ('unknown' as const),
  status: 'ACTIVE',
  email: 'admin@empresa.com',
  installedAt: '2026-01-01T12:00:00.000Z',
})

const domainWith = (apps: ReturnType<typeof app>[]) => ({
  id: 'domain-1',
  name: 'empresa.bitrix24.com.br',
  memberId: 'member-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  apps,
})

const SUBSCRIPTION = {
  id: '1142-1',
  status: 'active',
  modality: 'stripe',
  plan: { name: 'ThinkZap Mensal' },
  currentPeriodEnd: new Date('2026-12-01T00:00:00.000Z'),
}

const repository = (domain: unknown): PortalDomainReadRepository => ({
  listAll: vi.fn(),
  findById: vi.fn().mockResolvedValue(domain),
  countAll: vi.fn(),
})

const hydration = (overrides: Record<string, unknown> = {}) =>
  ({
    titles: {
      getMirrorsBySpaIds: vi.fn().mockResolvedValue({
        titles: new Map(),
        existing: new Set(),
        unverified: new Set(),
      }),
    },
    subscriptions: {
      getSubscriptionsByAplication: vi.fn().mockResolvedValue([SUBSCRIPTION]),
    },
    items: {
      getSubscriptionItemsBySubscription: vi.fn().mockResolvedValue([
        { id: 'item-1', metadata: { provider: 'ZAPI' } },
        { id: 'item-2', metadata: { provider: 'NONE' } },
      ]),
    },
    ...overrides,
  }) as never

describe('GetPortalDomainDetail', () => {
  it('hidrata o contrato do app espelhado, contando só as linhas', async () => {
    const useCase = new GetPortalDomainDetail(
      repository(domainWith([app('app-1', '1060-1')])),
      hydration(),
    )

    const result = await useCase.execute('domain-1')

    expect(result.apps[0]?.contract).toEqual({
      status: 'ok',
      subscriptions: [
        {
          id: '1142-1',
          status: 'active',
          modality: 'stripe',
          planName: 'ThinkZap Mensal',
          currentPeriodEnd: '2026-12-01T00:00:00.000Z',
          lineCount: 1,
        },
      ],
    })
  })

  it('marca app sem espelho como no-mirror sem consultar o CRM', async () => {
    const getSubscriptionsByAplication = vi.fn()

    const useCase = new GetPortalDomainDetail(
      repository(domainWith([app('app-1', null)])),
      hydration({ subscriptions: { getSubscriptionsByAplication } }),
    )

    const result = await useCase.execute('domain-1')

    expect(result.apps[0]?.contract).toEqual({ status: 'no-mirror' })
    expect(getSubscriptionsByAplication).not.toHaveBeenCalled()
  })

  it('isola a falha de leitura no app afetado', async () => {
    const getSubscriptionsByAplication = vi
      .fn()
      .mockImplementation((spaId: string) =>
        spaId === '1060-1'
          ? Promise.reject(new Error('bitrix fora'))
          : Promise.resolve([SUBSCRIPTION]),
      )

    const useCase = new GetPortalDomainDetail(
      repository(domainWith([app('app-1', '1060-1'), app('app-2', '1060-2')])),
      hydration({ subscriptions: { getSubscriptionsByAplication } }),
    )

    const result = await useCase.execute('domain-1')

    expect(result.apps[0]?.contract).toEqual({ status: 'unavailable' })
    expect(result.apps[1]?.contract?.status).toBe('ok')
  })

  it('distingue app espelhado sem contrato de indisponível', async () => {
    const useCase = new GetPortalDomainDetail(
      repository(domainWith([app('app-1', '1060-1')])),
      hydration({
        subscriptions: {
          getSubscriptionsByAplication: vi.fn().mockResolvedValue([]),
        },
      }),
    )

    const result = await useCase.execute('domain-1')

    expect(result.apps[0]?.contract).toEqual({
      status: 'ok',
      subscriptions: [],
    })
  })

  it('sobrescreve o título com o do espelho', async () => {
    const useCase = new GetPortalDomainDetail(
      repository(domainWith([app('app-1', '1060-1')])),
      hydration({
        titles: {
          getMirrorsBySpaIds: vi.fn().mockResolvedValue({
            titles: new Map([['1060-1', 'ThinkZap — Matriz']]),
            existing: new Set(['1060-1']),
            unverified: new Set(),
          }),
        },
      }),
    )

    const result = await useCase.execute('domain-1')

    expect(result.apps[0]?.title).toBe('ThinkZap — Matriz')
    expect(result.apps[0]?.mirror).toBe('linked')
  })

  it('espelho apagado no CRM continua lendo contrato e marca mirror-missing', async () => {
    const useCase = new GetPortalDomainDetail(
      repository(domainWith([app('app-1', '1060-1')])),
      hydration(),
    )

    const result = await useCase.execute('domain-1')

    expect(result.apps[0]?.mirror).toBe('mirror-missing')
  })

  it('falha de leitura do espelho vira unknown', async () => {
    const useCase = new GetPortalDomainDetail(
      repository(domainWith([app('app-1', '1060-1')])),
      hydration({
        titles: {
          getMirrorsBySpaIds: vi.fn().mockRejectedValue(new Error('fora')),
        },
      }),
    )

    const result = await useCase.execute('domain-1')

    expect(result.apps[0]?.mirror).toBe('unknown')
  })

  it('app sem espelho fica no-mirror', async () => {
    const useCase = new GetPortalDomainDetail(
      repository(domainWith([app('app-1', null)])),
      hydration(),
    )

    const result = await useCase.execute('domain-1')

    expect(result.apps[0]?.mirror).toBe('no-mirror')
  })

  it('resume aplicações, assinaturas ativas, linhas e usuários MCP', async () => {
    const useCase = new GetPortalDomainDetail(
      repository({
        ...domainWith([app('app-1', '1060-1'), app('app-2', null)]),
        mcpUserCount: 2,
      }),
      hydration(),
    )

    const result = await useCase.execute('domain-1')

    expect(result.summary).toEqual({
      apps: 2,
      activeSubscriptions: 1,
      lines: 1,
      mcpUsers: 2,
      incomplete: false,
    })
  })

  it('marca o resumo como incompleto quando um contrato está indisponível', async () => {
    const useCase = new GetPortalDomainDetail(
      repository({
        ...domainWith([app('app-1', '1060-1'), app('app-2', '1060-2')]),
        mcpUserCount: 0,
      }),
      hydration({
        subscriptions: {
          getSubscriptionsByAplication: vi
            .fn()
            .mockImplementation((spaId: string) =>
              spaId === '1060-1'
                ? Promise.reject(new Error('bitrix fora'))
                : Promise.resolve([SUBSCRIPTION]),
            ),
        },
      }),
    )

    const result = await useCase.execute('domain-1')

    expect(result.summary?.incomplete).toBe(true)
    expect(result.summary?.activeSubscriptions).toBe(1)
  })

  it('assinatura cancelada não conta linhas nem como ativa', async () => {
    const useCase = new GetPortalDomainDetail(
      repository({ ...domainWith([app('app-1', '1060-1')]), mcpUserCount: 0 }),
      hydration({
        subscriptions: {
          getSubscriptionsByAplication: vi
            .fn()
            .mockResolvedValue([{ ...SUBSCRIPTION, status: 'cancelled' }]),
        },
      }),
    )

    const result = await useCase.execute('domain-1')

    expect(result.summary?.activeSubscriptions).toBe(0)
    expect(result.summary?.lines).toBe(0)
  })

  it('lança quando o domínio não existe', async () => {
    const useCase = new GetPortalDomainDetail(repository(null), hydration())

    await expect(useCase.execute('missing-id')).rejects.toBeInstanceOf(
      PortalDomainNotFoundError,
    )
  })
})
