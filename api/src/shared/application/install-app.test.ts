import { beforeEach, describe, expect, it, vi } from 'vitest'

const { restClientMock } = vi.hoisted(() => ({ restClientMock: vi.fn() }))

vi.mock('@/shared/infra/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/shared/infra/clients/bitrix-rest.client', () => ({
  BitrixRestClient: restClientMock,
}))

import {
  AppCodeNotFoundError,
  InstallApp,
  InstallStepError,
  type InstallStep,
} from './install-app'

const input = {
  domain: 'acme.bitrix24.com.br',
  memberId: 'member-1',
  appCode: 'crmthink.thinkzap',
  email: 'admin@acme.com',
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresIn: 3600,
}

const availableApp = {
  id: 'crmthink.thinkzap',
  code: 'local.marketplace.id',
  secret: 'secret-1',
  name: 'ThinkZap',
}

const domainRow = {
  id: 'domain-1',
  name: input.domain,
  memberId: input.memberId,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const appRow = {
  id: 'app-1',
  domainId: 'domain-1',
  appCodeId: 'crmthink.thinkzap',
  email: input.email,
  status: 'ACTIVE',
  installedAt: new Date(),
  updatedAt: new Date(),
}

function makeDeps() {
  const installer = { appCode: input.appCode, install: vi.fn() }

  return {
    availableApps: { getById: vi.fn().mockResolvedValue(availableApp) },
    upsertDomain: { execute: vi.fn().mockResolvedValue(domainRow) },
    upsertInstalledApp: { execute: vi.fn().mockResolvedValue(appRow) },
    upsertCredential: { execute: vi.fn().mockResolvedValue({ id: 'cred-1' }) },
    getOrCreateSpa: { execute: vi.fn().mockResolvedValue({ id: '4242' }) },
    aplications: { linkSpaItem: vi.fn().mockResolvedValue({ id: 'app-1' }) },
    installers: { get: vi.fn().mockReturnValue(installer) },
    installer,
  }
}

/** Captura a falha esperada sem que o tipo vire união com o resultado de sucesso. */
async function failureOf(
  run: () => Promise<unknown>,
): Promise<InstallStepError> {
  let caught: unknown

  try {
    await run()
  } catch (error) {
    caught = error
  }

  if (!(caught instanceof InstallStepError)) {
    throw new Error(`esperava InstallStepError, veio ${String(caught)}`)
  }

  return caught
}

function firstArg<T>(mock: { mock: { calls: unknown[][] } }): T {
  const [call] = mock.mock.calls
  if (!call) throw new Error('mock não foi chamado')

  return call[0] as T
}

function makeSut(deps: ReturnType<typeof makeDeps>) {
  return new InstallApp(
    deps.availableApps as never,
    deps.upsertDomain as never,
    deps.upsertInstalledApp as never,
    deps.upsertCredential as never,
    deps.getOrCreateSpa as never,
    deps.aplications as never,
    deps.installers as never,
  )
}

describe('InstallApp', () => {
  let deps: ReturnType<typeof makeDeps>

  beforeEach(() => {
    // `function` e não arrow: o caso de uso instancia com `new`.
    restClientMock.mockReset().mockImplementation(function () {
      return { callMethod: vi.fn() }
    })
    deps = makeDeps()
  })

  it('conclui a instalação devolvendo domínio, app e id do item da SPA', async () => {
    const result = await makeSut(deps).execute(input)

    expect(result).toEqual({
      domain: domainRow,
      app: appRow,
      spaItemId: '4242',
    })
  })

  it('vincula o item da SPA antes de rodar o installer', async () => {
    const order: string[] = []
    deps.aplications.linkSpaItem.mockImplementation(() => {
      order.push('link')
      return Promise.resolve({ id: 'app-1' })
    })
    deps.installer.install.mockImplementation(() => {
      order.push('installer')
      return Promise.resolve()
    })

    await makeSut(deps).execute(input)

    expect(order).toEqual(['link', 'installer'])
  })

  it('entrega ao installer o contexto com a instalação já vinculada', async () => {
    await makeSut(deps).execute(input)

    expect(deps.installer.install).toHaveBeenCalledWith(
      expect.objectContaining({
        appCode: 'crmthink.thinkzap',
        installedAppId: 'app-1',
        spaItemId: '4242',
        domain: input.domain,
        email: input.email,
        memberId: input.memberId,
      }),
    )
  })

  it('converte expires_in como TTL em segundos, não como epoch em ms', async () => {
    await makeSut(deps).execute(input)

    const { expiresAt } = firstArg<{ expiresAt: Date }>(
      deps.upsertCredential.execute,
    )
    expect(expiresAt.getFullYear()).toBeGreaterThan(2020)
  })

  it('reinstalação reaproveita a mesma linha e revincula o mesmo item', async () => {
    await makeSut(deps).execute(input)

    expect(deps.upsertInstalledApp.execute).toHaveBeenCalledWith({
      domainId: 'domain-1',
      appCodeId: 'crmthink.thinkzap',
      email: input.email,
    })
    expect(deps.aplications.linkSpaItem).toHaveBeenCalledWith('app-1', '4242')
  })

  it('conclui com sucesso quando o app não tem installer', async () => {
    deps.installers.get.mockReturnValue(undefined)

    await expect(makeSut(deps).execute(input)).resolves.toMatchObject({
      spaItemId: '4242',
    })
  })

  it('devolve AppCodeNotFoundError quando o app code não existe', async () => {
    deps.availableApps.getById.mockResolvedValue(null)

    const error = await failureOf(() => makeSut(deps).execute(input))

    expect(error.step).toBe('resolve-app-code')
    expect(error.cause).toBeInstanceOf(AppCodeNotFoundError)
    expect(deps.upsertDomain.execute).not.toHaveBeenCalled()
  })

  const failures: Array<{
    step: InstallStep
    break: (d: ReturnType<typeof makeDeps>) => void
    notCalled: (d: ReturnType<typeof makeDeps>) => unknown
  }> = [
    {
      step: 'upsert-domain',
      break: d => d.upsertDomain.execute.mockRejectedValue(new Error('db')),
      notCalled: d => d.upsertInstalledApp.execute,
    },
    {
      step: 'upsert-app',
      break: d =>
        d.upsertInstalledApp.execute.mockRejectedValue(new Error('db')),
      notCalled: d => d.upsertCredential.execute,
    },
    {
      step: 'upsert-credential',
      break: d => d.upsertCredential.execute.mockRejectedValue(new Error('db')),
      notCalled: d => d.getOrCreateSpa.execute,
    },
    {
      step: 'resolve-spa-item',
      break: d => d.getOrCreateSpa.execute.mockRejectedValue(new Error('bx')),
      notCalled: d => d.aplications.linkSpaItem,
    },
    {
      step: 'link-spa-item',
      break: d => d.aplications.linkSpaItem.mockRejectedValue(new Error('db')),
      notCalled: d => d.installer.install,
    },
  ]

  it.each(failures)(
    'falha em $step aborta e não executa os passos seguintes',
    async ({ step, break: breakStep, notCalled }) => {
      breakStep(deps)

      const error = await failureOf(() => makeSut(deps).execute(input))

      expect(error.step).toBe(step)
      expect(notCalled(deps)).not.toHaveBeenCalled()
    },
  )

  it('falha do installer sobe como run-installer', async () => {
    deps.installer.install.mockRejectedValue(new Error('placement negado'))

    const error = await failureOf(() => makeSut(deps).execute(input))

    expect(error.step).toBe('run-installer')
    expect(error.message).toBe('placement negado')
  })

  it('marca como upstream só as falhas de origem Bitrix', async () => {
    deps.getOrCreateSpa.execute.mockRejectedValue(new Error('bx'))
    const upstream = await failureOf(() => makeSut(deps).execute(input))
    expect(upstream.isUpstream).toBe(true)

    deps = makeDeps()
    deps.upsertDomain.execute.mockRejectedValue(new Error('db'))
    const local = await failureOf(() => makeSut(deps).execute(input))
    expect(local.isUpstream).toBe(false)
  })
})
