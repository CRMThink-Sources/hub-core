import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/config/prisma.js', () => ({ prisma: {} }))
vi.mock('@/shared/infra/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/config/env', () => ({ env: { bitrix: {} } }))
vi.mock('@/shared/app-catalog/app-catalog', () => ({
  thinkzapAppCodeId: () => 'crmthink.thinkzap',
}))
vi.mock('./resolve-bitrix-client-for-app', () => ({
  resolveBitrixClientForApp: vi.fn(),
}))

import {
  bindMessageEventsForApp,
  type BindMessageEventsDeps,
} from './bind-message-events-for-app'
import {
  PortalAppNotFoundError,
  ThinkzapNotInstalledError,
} from '../domain/errors/portal-domain.errors'

const HANDLER = 'https://api.test/webhooks/bitrix'
const client = { callMethod: vi.fn() }

function makeDeps(over: Partial<BindMessageEventsDeps> = {}) {
  return {
    findApp: vi.fn().mockResolvedValue({ appCodeId: 'crmthink.thinkzap' }),
    resolveClient: vi.fn().mockResolvedValue({ client, domainName: 'x' }),
    ensureBindings: vi.fn().mockResolvedValue(undefined),
    ensureConnector: vi.fn().mockResolvedValue('updated'),
    webhookUrl: () => HANDLER,
    thinkzapCode: () => 'crmthink.thinkzap',
    ...over,
  } as BindMessageEventsDeps & Record<string, ReturnType<typeof vi.fn>>
}

describe('bindMessageEventsForApp', () => {
  beforeEach(() => vi.clearAllMocks())

  it('liga edição e exclusão e reaplica o registro do conector', async () => {
    const deps = makeDeps()

    const out = await bindMessageEventsForApp('app-1', deps)

    expect(deps.ensureBindings).toHaveBeenCalledWith(client, [
      { event: 'ONIMCONNECTORMESSAGEUPDATE', handler: HANDLER },
      { event: 'ONIMCONNECTORMESSAGEDELETE', handler: HANDLER },
    ])
    expect(deps.ensureConnector).toHaveBeenCalledWith(client)
    expect(out).toEqual({ connectorResult: 'updated' })
  })

  it('segunda execução termina com sucesso (idempotência vem do ensure)', async () => {
    const deps = makeDeps()

    await bindMessageEventsForApp('app-1', deps)
    await expect(bindMessageEventsForApp('app-1', deps)).resolves.toEqual({
      connectorResult: 'updated',
    })
  })

  it('aplicação inexistente: não chama o portal', async () => {
    const deps = makeDeps({ findApp: vi.fn().mockResolvedValue(null) })

    await expect(bindMessageEventsForApp('x', deps)).rejects.toBeInstanceOf(
      PortalAppNotFoundError,
    )
    expect(deps.resolveClient).not.toHaveBeenCalled()
  })

  it('aplicação que não é o ThinkZap: não chama o portal', async () => {
    const deps = makeDeps({
      findApp: vi.fn().mockResolvedValue({ appCodeId: 'outro.app' }),
    })

    await expect(bindMessageEventsForApp('x', deps)).rejects.toBeInstanceOf(
      ThinkzapNotInstalledError,
    )
    expect(deps.ensureBindings).not.toHaveBeenCalled()
  })

  it('sem webhook configurado: erro de configuração, nada é ligado', async () => {
    const deps = makeDeps({ webhookUrl: () => undefined })

    await expect(bindMessageEventsForApp('x', deps)).rejects.toMatchObject({
      errorCode: 'thinkzap.config.missing_env',
    })
    expect(deps.ensureBindings).not.toHaveBeenCalled()
  })

  it('falha do registro do conector propaga', async () => {
    const deps = makeDeps({
      ensureConnector: vi.fn().mockRejectedValue(new Error('register falhou')),
    })

    await expect(bindMessageEventsForApp('x', deps)).rejects.toThrow(
      'register falhou',
    )
  })
})
