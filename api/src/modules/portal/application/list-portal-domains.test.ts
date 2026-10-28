import { describe, expect, it, vi } from 'vitest'
import { ListPortalDomains } from './list-portal-domains'
import type { PortalDomainReadRepository } from '../domain/repositories/portal-domain-read.repository'
import type {
  AplicationMirrorReader,
  AplicationMirrorsRead,
} from '@/modules/application/domain/repositories/aplication.repository'

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

const repository = (domains: unknown[]): PortalDomainReadRepository => ({
  listAll: vi.fn().mockResolvedValue(domains),
  findById: vi.fn(),
  countAll: vi.fn(),
})

const read = (
  overrides: Partial<AplicationMirrorsRead> = {},
): AplicationMirrorsRead => ({
  titles: new Map(),
  existing: new Set(),
  unverified: new Set(),
  ...overrides,
})

const mirrors = (
  getMirrorsBySpaIds: ReturnType<typeof vi.fn>,
): AplicationMirrorReader =>
  ({ getMirrorsBySpaIds, getTitlesBySpaIds: vi.fn() }) as never

describe('ListPortalDomains', () => {
  it('sobrescreve o título com o do espelho da SPA e marca como linked', async () => {
    const getMirrorsBySpaIds = vi.fn().mockResolvedValue(
      read({
        titles: new Map([['1060-1', 'ThinkZap — Matriz']]),
        existing: new Set(['1060-1']),
      }),
    )

    const useCase = new ListPortalDomains(
      repository([domainWith([app('app-1', '1060-1')])]),
      mirrors(getMirrorsBySpaIds),
    )

    const result = await useCase.execute()

    expect(getMirrorsBySpaIds).toHaveBeenCalledWith(['1060-1'])
    expect(result.domains[0]?.apps[0]?.title).toBe('ThinkZap — Matriz')
    expect(result.domains[0]?.apps[0]?.mirror).toBe('linked')
    expect(result.total).toBe(1)
  })

  it('item que existe sem título: linked, com o nome do app', async () => {
    const useCase = new ListPortalDomains(
      repository([domainWith([app('app-1', '1060-1')])]),
      mirrors(
        vi.fn().mockResolvedValue(read({ existing: new Set(['1060-1']) })),
      ),
    )

    const result = await useCase.execute()

    expect(result.domains[0]?.apps[0]?.title).toBe('ThinkZap')
    expect(result.domains[0]?.apps[0]?.mirror).toBe('linked')
  })

  it('item que a SPA não devolveu: mirror-missing', async () => {
    const useCase = new ListPortalDomains(
      repository([domainWith([app('app-1', '1060-1')])]),
      mirrors(vi.fn().mockResolvedValue(read())),
    )

    const result = await useCase.execute()

    expect(result.domains[0]?.apps[0]?.title).toBe('ThinkZap')
    expect(result.domains[0]?.apps[0]?.mirror).toBe('mirror-missing')
  })

  it('lote com falha: unknown, nunca mirror-missing', async () => {
    const useCase = new ListPortalDomains(
      repository([domainWith([app('app-1', '1060-1')])]),
      mirrors(
        vi.fn().mockResolvedValue(read({ unverified: new Set(['1060-1']) })),
      ),
    )

    const result = await useCase.execute()

    expect(result.domains[0]?.apps[0]?.mirror).toBe('unknown')
  })

  it('não consulta o CRM quando nenhum app tem espelho, e marca no-mirror', async () => {
    const getMirrorsBySpaIds = vi.fn()

    const useCase = new ListPortalDomains(
      repository([domainWith([app('app-1', null)])]),
      mirrors(getMirrorsBySpaIds),
    )

    const result = await useCase.execute()

    expect(getMirrorsBySpaIds).not.toHaveBeenCalled()
    expect(result.domains[0]?.apps[0]?.title).toBe('ThinkZap')
    expect(result.domains[0]?.apps[0]?.mirror).toBe('no-mirror')
  })

  it('leitura que lança: degrada para o nome do app e unknown', async () => {
    const useCase = new ListPortalDomains(
      repository([domainWith([app('app-1', '1060-1')])]),
      mirrors(vi.fn().mockRejectedValue(new Error('bitrix fora'))),
    )

    const result = await useCase.execute()

    expect(result.domains[0]?.apps[0]?.title).toBe('ThinkZap')
    expect(result.domains[0]?.apps[0]?.mirror).toBe('unknown')
  })

  it('não resolve contrato na listagem', async () => {
    const useCase = new ListPortalDomains(
      repository([domainWith([app('app-1', '1060-1')])]),
      mirrors(vi.fn().mockResolvedValue(read())),
    )

    const result = await useCase.execute()

    expect(result.domains[0]?.apps[0]).not.toHaveProperty('contract')
  })

  it('devolve lista vazia quando não há domínio', async () => {
    const useCase = new ListPortalDomains(repository([]), mirrors(vi.fn()))

    const result = await useCase.execute()

    expect(result).toEqual({ domains: [], total: 0 })
  })
})
