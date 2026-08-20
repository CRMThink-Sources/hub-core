import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

// O registry real importa os 4 installers, e o do ThinkZap arrasta repositórios
// Prisma. Este teste é sobre a composição, não sobre persistência.
vi.mock('@/config/prisma.js', () => ({ prisma: {} }))

import { appInstallerRegistry } from './setup-app-installers'
import type { AppInstallContext } from '@/shared/domain/app-installer'

const context = {
  client: { callMethod: vi.fn() },
  installedAppId: 'app-1',
  spaItemId: '1',
  domain: 'acme.bitrix24.com.br',
  email: 'admin@acme.com',
  memberId: 'member-1',
} as unknown as AppInstallContext

describe('appInstallerRegistry', () => {
  it.each([
    'crmthink.thinkzap',
    'crmthink.clicksign',
    'crmthink.thinkanalise',
    'crmthink.importsheet',
  ])('tem installer registrado para %s', appCode => {
    expect(appInstallerRegistry.get(appCode)?.appCode).toBe(appCode)
  })

  it('devolve undefined para app code desconhecido', () => {
    expect(appInstallerRegistry.get('crmthink.inexistente')).toBeUndefined()
  })

  it.each(['crmthink.thinkanalise', 'crmthink.importsheet'])(
    '%s conclui sem chamar o Bitrix',
    async appCode => {
      const callMethod = vi.fn()

      await appInstallerRegistry
        .get(appCode)
        ?.install({ ...context, appCode, client: { callMethod } as never })

      expect(callMethod).not.toHaveBeenCalled()
    },
  )
})
