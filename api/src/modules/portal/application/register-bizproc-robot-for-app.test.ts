import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerBizprocRobotForApp } from './register-bizproc-robot-for-app'
import { ensureThinkzapRobot } from '@/modules/thinkzap/application/ensure-thinkzap-robot'
import { ensureTemplateRobot } from '@/modules/thinkzap/application/ensure-template-robot'
import { syncThinkzapRobotConnectorOptions } from '@/modules/thinkzap/application/sync-robot-connectors'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

vi.mock('@/modules/thinkzap/application/ensure-thinkzap-robot')
vi.mock('@/modules/thinkzap/application/ensure-template-robot')
vi.mock('@/modules/thinkzap/application/sync-robot-connectors', () => ({
  syncThinkzapRobotConnectorOptions: vi.fn(),
}))
vi.mock('./resolve-bitrix-client-for-app', () => ({
  resolveBitrixClientForApp: vi.fn(),
}))
vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

describe('registerBizprocRobotForApp', () => {
  const client = { callMethod: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveBitrixClientForApp).mockResolvedValue({
      client: client as never,
      domainName: 'empresa.bitrix24.com.br',
    })
    vi.mocked(ensureThinkzapRobot).mockResolvedValue('created')
    vi.mocked(ensureTemplateRobot).mockResolvedValue('created')
    vi.mocked(syncThinkzapRobotConnectorOptions).mockResolvedValue(undefined)
  })

  it('registers both robots and syncs connector options', async () => {
    const result = await registerBizprocRobotForApp('app-1')

    expect(ensureThinkzapRobot).toHaveBeenCalledWith(client)
    expect(ensureTemplateRobot).toHaveBeenCalledWith(client)
    expect(syncThinkzapRobotConnectorOptions).toHaveBeenCalledWith('app-1')
    expect(result).toEqual({ result: 'created', templateResult: 'created' })
  })

  it('does not sync connectors when registration is skipped', async () => {
    vi.mocked(ensureThinkzapRobot).mockResolvedValue('skipped')

    const result = await registerBizprocRobotForApp('app-1')

    expect(syncThinkzapRobotConnectorOptions).not.toHaveBeenCalled()
    expect(result).toEqual({ result: 'skipped', templateResult: 'created' })
  })

  // Robôs independentes: um portal sem o robô novo não pode perder a correção de
  // definição do robô que já usa.
  it('registers the free-send robot even when the template robot fails', async () => {
    vi.mocked(ensureTemplateRobot).mockRejectedValue(
      new Error('Access denied!'),
    )

    const result = await registerBizprocRobotForApp('app-1')

    expect(ensureThinkzapRobot).toHaveBeenCalledWith(client)
    expect(result).toEqual({ result: 'created', templateResult: 'failed' })
  })

  it('reports the template robot result when it is skipped', async () => {
    vi.mocked(ensureTemplateRobot).mockResolvedValue('skipped')

    const result = await registerBizprocRobotForApp('app-1')

    expect(result.templateResult).toBe('skipped')
  })
})
