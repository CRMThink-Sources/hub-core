import { describe, expect, it, vi } from 'vitest'
import { GetPortalAppDetail } from './get-portal-app-detail'
import { PortalAppNotFoundError } from '../domain/errors/portal-domain.errors'
import type { PortalAppDetail } from '../domain/entities/portal-domain'

const appDetail = (spaId: string | null): PortalAppDetail => ({
  id: 'app-1',
  appCodeId: 'crmthink.thinkzap',
  appCode: 'thinkzap',
  appName: 'ThinkZap',
  title: 'ThinkZap',
  spaId,
  mirror: spaId === null ? 'no-mirror' : 'unknown',
  status: 'ACTIVE',
  email: 'admin@empresa.com',
  installedAt: '2026-01-01T12:00:00.000Z',
  locale: 'pt',
  domain: {
    id: 'domain-1',
    name: 'empresa.bitrix24.com.br',
    memberId: 'member-1',
  },
})

const mirrors = (impl: () => Promise<unknown>) =>
  ({
    getMirrorsBySpaIds: vi.fn(impl),
    getTitlesBySpaIds: vi.fn(),
  }) as never

const apps = (detail: PortalAppDetail | null) => ({
  findById: vi.fn().mockResolvedValue(detail),
})

describe('GetPortalAppDetail', () => {
  it('devolve a instalação com o título do espelho e linked', async () => {
    const useCase = new GetPortalAppDetail(
      apps(appDetail('1060-1')),
      mirrors(() =>
        Promise.resolve({
          titles: new Map([['1060-1', 'ThinkZap — Matriz']]),
          existing: new Set(['1060-1']),
          unverified: new Set(),
        }),
      ),
    )

    const result = await useCase.execute('app-1')

    expect(result.title).toBe('ThinkZap — Matriz')
    expect(result.mirror).toBe('linked')
    expect(result.domain.name).toBe('empresa.bitrix24.com.br')
    expect(result.locale).toBe('pt')
  })

  it('espelho que a SPA não devolveu: mirror-missing', async () => {
    const useCase = new GetPortalAppDetail(
      apps(appDetail('1060-1')),
      mirrors(() =>
        Promise.resolve({
          titles: new Map(),
          existing: new Set(),
          unverified: new Set(),
        }),
      ),
    )

    expect((await useCase.execute('app-1')).mirror).toBe('mirror-missing')
  })

  it('Bitrix fora: unknown', async () => {
    const useCase = new GetPortalAppDetail(
      apps(appDetail('1060-1')),
      mirrors(() => Promise.reject(new Error('fora'))),
    )

    expect((await useCase.execute('app-1')).mirror).toBe('unknown')
  })

  it('sem espelho não consulta o CRM', async () => {
    const reader = mirrors(() => Promise.reject(new Error('não devia')))
    const useCase = new GetPortalAppDetail(apps(appDetail(null)), reader)

    const result = await useCase.execute('app-1')

    expect(result.mirror).toBe('no-mirror')
    expect(
      (reader as { getMirrorsBySpaIds: ReturnType<typeof vi.fn> })
        .getMirrorsBySpaIds,
    ).not.toHaveBeenCalled()
  })

  it('instalação inexistente lança PortalAppNotFoundError', async () => {
    const useCase = new GetPortalAppDetail(
      apps(null),
      mirrors(() => Promise.resolve()),
    )

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      PortalAppNotFoundError,
    )
  })
})
