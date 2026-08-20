import { describe, expect, it, vi } from 'vitest'
import { RegisterBizprocRobotAppController } from './register-bizproc-robot-app-controller'
import { registerBizprocRobotForApp } from '../../application/register-bizproc-robot-for-app'
import { ThinkzapNotInstalledError } from '../../domain/errors/portal-domain.errors'

vi.mock('../../application/register-bizproc-robot-for-app', () => ({
  registerBizprocRobotForApp: vi.fn(),
}))

describe('RegisterBizprocRobotAppController', () => {
  const controller = new RegisterBizprocRobotAppController()

  it('returns 200 with result', async () => {
    vi.mocked(registerBizprocRobotForApp).mockResolvedValue({
      result: 'created',
      templateResult: 'created',
    })

    const response = await controller.perform(
      { params: { appId: 'app-1' } } as never,
      {} as never,
    )

    expect(response.status).toBe(200)
    expect(response.result).toEqual({
      result: 'created',
      templateResult: 'created',
    })
  })

  it('returns 422 when thinkzap is not installed', async () => {
    vi.mocked(registerBizprocRobotForApp).mockRejectedValue(
      new ThinkzapNotInstalledError(),
    )

    const response = await controller.perform(
      { params: { appId: 'app-1' } } as never,
      {} as never,
    )

    expect(response.status).toBe(422)
  })
})
