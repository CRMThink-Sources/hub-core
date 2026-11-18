import { describe, expect, it, vi } from 'vitest'

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

import { makeInsightsSourceResolver } from './make-insights-source-resolver'

describe('makeInsightsSourceResolver', () => {
  it('reusa a mesma fonte lean por app, inclusive em chamadas simultâneas', async () => {
    const resolve = makeInsightsSourceResolver()
    const [a, b] = await Promise.all([resolve('app-1'), resolve('app-1')])
    const c = await resolve('app-1')
    const other = await resolve('app-2')
    expect(a).toBe(b)
    expect(a).toBe(c)
    expect(other).not.toBe(a)
    expect(a.mode).toBe('lean')
    expect(a.portal).toBe('p.bitrix24.com.br')
  })
})
