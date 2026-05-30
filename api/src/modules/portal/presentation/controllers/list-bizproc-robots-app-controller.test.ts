import { describe, expect, it, vi } from 'vitest'
import { ListBizprocRobotsAppController } from './list-bizproc-robots-app-controller'
import { listBizprocRobotsForApp } from '../../application/list-bizproc-robots-for-app'
import { ThinkzapNotInstalledError } from '../../domain/errors/portal-domain.errors'

vi.mock('../../application/list-bizproc-robots-for-app', () => ({
  listBizprocRobotsForApp: vi.fn(),
}))

describe('ListBizprocRobotsAppController', () => {
  const controller = new ListBizprocRobotsAppController()

  it('returns 200 with robots list', async () => {
    vi.mocked(listBizprocRobotsForApp).mockResolvedValue({
      robots: [
        {
          code: 'thinkzap_robot',
          name: 'ThinkZap Robot',
          isThinkzap: true,
        },
      ],
    })

    const response = await controller.perform(
      { params: { appId: 'app-1' } } as never,
      {} as never,
    )

    expect(response.status).toBe(200)
    expect(response.result).toEqual({
      robots: [
        {
          code: 'thinkzap_robot',
          name: 'ThinkZap Robot',
          isThinkzap: true,
        },
      ],
    })
  })

  it('returns 422 when thinkzap is not installed', async () => {
    vi.mocked(listBizprocRobotsForApp).mockRejectedValue(
      new ThinkzapNotInstalledError(),
    )

    const response = await controller.perform(
      { params: { appId: 'app-1' } } as never,
      {} as never,
    )

    expect(response.status).toBe(422)
  })
})
