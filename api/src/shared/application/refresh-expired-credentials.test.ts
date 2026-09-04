import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { apiLogger } from '@/shared/infra/logger'
import { RefreshExpiredCredentials } from './refresh-expired-credentials'

const credential = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'cred-1',
  appId: 'app-1',
  clientId: 'client-1',
  clientSecret: 'secret-1',
  accessToken: 'at',
  refreshToken: 'rt',
  expiresAt: new Date('2026-09-04T12:00:00.000Z'),
  refreshFailedAttempts: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
})

function makeDeps() {
  return {
    listExpiredRepo: { listExpired: vi.fn().mockResolvedValue([]) },
    refreshGateway: { refresh: vi.fn() },
    updateRepo: { update: vi.fn() },
    recordFailureRepo: { recordFailure: vi.fn() },
  }
}

const sut = (deps: ReturnType<typeof makeDeps>) =>
  new RefreshExpiredCredentials(
    deps.listExpiredRepo as never,
    deps.refreshGateway as never,
    deps.updateRepo as never,
    deps.recordFailureRepo as never,
  )

describe('RefreshExpiredCredentials', () => {
  let deps: ReturnType<typeof makeDeps>

  beforeEach(() => {
    deps = makeDeps()
    vi.mocked(apiLogger.error).mockReset()
  })

  it('sucesso não registra falha', async () => {
    deps.listExpiredRepo.listExpired.mockResolvedValue([credential()])
    deps.refreshGateway.refresh.mockResolvedValue({
      accessToken: 'at-novo',
      refreshToken: 'rt-novo',
      expiresAt: new Date('2026-09-04T13:00:00.000Z'),
    })

    await sut(deps).execute()

    expect(deps.updateRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ appId: 'app-1', accessToken: 'at-novo' }),
    )
    expect(deps.recordFailureRepo.recordFailure).not.toHaveBeenCalled()
  })

  it('falha registra a credencial certa, sem mexer nas outras', async () => {
    deps.listExpiredRepo.listExpired.mockResolvedValue([
      credential({ id: 'cred-1', appId: 'app-1' }),
      credential({ id: 'cred-2', appId: 'app-2' }),
    ])
    deps.refreshGateway.refresh
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({
        accessToken: 'at-novo',
        refreshToken: 'rt-novo',
        expiresAt: new Date('2026-09-04T13:00:00.000Z'),
      })
    deps.recordFailureRepo.recordFailure.mockResolvedValue({ attempts: 1 })

    await sut(deps).execute()

    expect(deps.recordFailureRepo.recordFailure).toHaveBeenCalledTimes(1)
    expect(deps.recordFailureRepo.recordFailure).toHaveBeenCalledWith('app-1')
  })

  it('loga o esgotamento só quando a falha atinge o máximo', async () => {
    deps.listExpiredRepo.listExpired.mockResolvedValue([credential()])
    deps.refreshGateway.refresh.mockRejectedValue(new Error('invalid_grant'))
    deps.recordFailureRepo.recordFailure.mockResolvedValue({ attempts: 5 })

    await sut(deps).execute()

    expect(apiLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'credential.refresh_exhausted',
        appId: 'app-1',
        attempts: 5,
      }),
      expect.any(String),
    )
  })

  it('não loga esgotamento antes do máximo', async () => {
    deps.listExpiredRepo.listExpired.mockResolvedValue([credential()])
    deps.refreshGateway.refresh.mockRejectedValue(new Error('timeout'))
    deps.recordFailureRepo.recordFailure.mockResolvedValue({ attempts: 3 })

    await sut(deps).execute()

    expect(apiLogger.error).not.toHaveBeenCalled()
  })
})
