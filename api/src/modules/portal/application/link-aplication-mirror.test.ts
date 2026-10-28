import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import {
  LinkAplicationMirror,
  LinkAplicationMirrorDeps,
  LinkMirrorRefusedError,
} from './link-aplication-mirror'
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
  locale: null,
  domain: { id: 'domain-1', name: 'acme.bitrix24.com.br', memberId: 'm-1' },
})

const read = (existing: string[] = [], unverified: string[] = []) => ({
  titles: new Map<string, string>(),
  existing: new Set(existing),
  unverified: new Set(unverified),
})

const makeDeps = (
  overrides: Partial<LinkAplicationMirrorDeps> & {
    app?: PortalAppDetail | null
    items?: string[]
    mirrorRead?: ReturnType<typeof read>
  } = {},
) => {
  const deps = {
    apps: {
      findById: vi
        .fn()
        .mockResolvedValue(
          overrides.app === undefined ? appDetail(null) : overrides.app,
        ),
    },
    mirrors: {
      getMirrorsBySpaIds: vi
        .fn()
        .mockResolvedValue(overrides.mirrorRead ?? read()),
      getTitlesBySpaIds: vi.fn(),
    },
    findItems: vi.fn().mockResolvedValue(overrides.items ?? ['512']),
    aplications: {
      getAplicationBySpaId: vi.fn().mockResolvedValue(null),
      linkSpaItem: vi.fn().mockResolvedValue({}),
    },
    invalidateCache: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  return deps
}

const refusal = async (promise: Promise<unknown>) => {
  const error = await promise.catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(LinkMirrorRefusedError)
  return error as LinkMirrorRefusedError
}

describe('LinkAplicationMirror', () => {
  it('um item encontrado: grava o spa_id, invalida o cache e devolve linked', async () => {
    const deps = makeDeps()

    const result = await new LinkAplicationMirror(deps).execute('app-1')

    expect(deps.findItems).toHaveBeenCalledWith(
      'acme.bitrix24.com.br',
      'crmthink.thinkzap',
    )
    expect(deps.aplications.linkSpaItem).toHaveBeenCalledWith('app-1', '512')
    expect(deps.aplications.linkSpaItem).toHaveBeenCalledTimes(1)
    expect(deps.invalidateCache).toHaveBeenCalledWith('512')
    expect(result).toEqual({ spaId: '512', mirror: 'linked' })
  })

  it('espelho apagado (mirror-missing) também pode ser religado', async () => {
    const deps = makeDeps({ app: appDetail('400'), mirrorRead: read() })

    await new LinkAplicationMirror(deps).execute('app-1')

    expect(deps.aplications.linkSpaItem).toHaveBeenCalledWith('app-1', '512')
  })

  it('já vinculado: already-linked, sem buscar nem gravar', async () => {
    const deps = makeDeps({ app: appDetail('400'), mirrorRead: read(['400']) })

    const error = await refusal(new LinkAplicationMirror(deps).execute('app-1'))

    expect(error.reason).toBe('already-linked')
    expect(deps.findItems).not.toHaveBeenCalled()
    expect(deps.aplications.linkSpaItem).not.toHaveBeenCalled()
  })

  it('espelho não verificado: unverified, sem gravar', async () => {
    const deps = makeDeps({
      app: appDetail('400'),
      mirrorRead: read([], ['400']),
    })

    const error = await refusal(new LinkAplicationMirror(deps).execute('app-1'))

    expect(error.reason).toBe('unverified')
    expect(deps.aplications.linkSpaItem).not.toHaveBeenCalled()
  })

  it('nenhum item: not-found, sem gravar', async () => {
    const deps = makeDeps({ items: [] })

    const error = await refusal(new LinkAplicationMirror(deps).execute('app-1'))

    expect(error.reason).toBe('not-found')
    expect(deps.aplications.linkSpaItem).not.toHaveBeenCalled()
  })

  it('itens duplicados: ambiguous com os ids, sem gravar', async () => {
    const deps = makeDeps({ items: ['512', '900'] })

    const error = await refusal(new LinkAplicationMirror(deps).execute('app-1'))

    expect(error.reason).toBe('ambiguous')
    expect(error.ids).toEqual(['512', '900'])
    expect(deps.aplications.linkSpaItem).not.toHaveBeenCalled()
  })

  it('item já vinculado a outra instalação: taken, sem gravar', async () => {
    const deps = makeDeps()
    vi.mocked(deps.aplications.getAplicationBySpaId).mockResolvedValue({
      id: 'app-2',
    } as never)

    const error = await refusal(new LinkAplicationMirror(deps).execute('app-1'))

    expect(error.reason).toBe('taken')
    expect(deps.aplications.linkSpaItem).not.toHaveBeenCalled()
  })

  it('corrida na restrição única (P2002) vira taken', async () => {
    const deps = makeDeps()
    vi.mocked(deps.aplications.linkSpaItem).mockRejectedValue(
      Object.assign(new Error('unique'), { code: 'P2002' }),
    )

    const error = await refusal(new LinkAplicationMirror(deps).execute('app-1'))

    expect(error.reason).toBe('taken')
    expect(deps.invalidateCache).not.toHaveBeenCalled()
  })

  it('instalação inexistente: PortalAppNotFoundError', async () => {
    const deps = makeDeps({ app: null })

    await expect(
      new LinkAplicationMirror(deps).execute('missing'),
    ).rejects.toBeInstanceOf(PortalAppNotFoundError)
  })
})
