import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteBizprocRobotForApp } from './delete-bizproc-robot-for-app'
import { deleteThinkzapRobot } from '@/modules/thinkzap/application/delete-thinkzap-robot'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

vi.mock('@/modules/thinkzap/application/delete-thinkzap-robot')
vi.mock('./resolve-bitrix-client-for-app', () => ({
  resolveBitrixClientForApp: vi.fn(),
}))

describe('deleteBizprocRobotForApp', () => {
  const client = { callMethod: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveBitrixClientForApp).mockResolvedValue({
      client: client as never,
      domainName: 'empresa.bitrix24.com.br',
    })
    vi.mocked(deleteThinkzapRobot).mockResolvedValue('deleted')
  })

  it('resolves client and deletes bizproc robot', async () => {
    const result = await deleteBizprocRobotForApp('app-1')

    expect(resolveBitrixClientForApp).toHaveBeenCalledWith('app-1')
    expect(deleteThinkzapRobot).toHaveBeenCalledWith(client)
    expect(result).toEqual({ result: 'deleted' })
  })
})
