import { describe, expect, it, vi } from 'vitest'
import { DeleteBizprocRobotAppController } from './delete-bizproc-robot-app-controller'
import { deleteBizprocRobotForApp } from '../../application/delete-bizproc-robot-for-app'
import { ThinkzapNotInstalledError } from '../../domain/errors/portal-domain.errors'

vi.mock('../../application/delete-bizproc-robot-for-app', () => ({
  deleteBizprocRobotForApp: vi.fn(),
}))

describe('DeleteBizprocRobotAppController', () => {
  const controller = new DeleteBizprocRobotAppController()

  it('returns 200 with result', async () => {
    vi.mocked(deleteBizprocRobotForApp).mockResolvedValue({
      result: 'deleted',
    })

    const response = await controller.perform(
      { params: { appId: 'app-1' } } as never,
      {} as never,
    )

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ result: 'deleted' })
  })

  it('returns 422 when thinkzap is not installed', async () => {
    vi.mocked(deleteBizprocRobotForApp).mockRejectedValue(
      new ThinkzapNotInstalledError(),
    )

    const response = await controller.perform(
      { params: { appId: 'app-1' } } as never,
      {} as never,
    )

    expect(response.status).toBe(422)
  })
})
