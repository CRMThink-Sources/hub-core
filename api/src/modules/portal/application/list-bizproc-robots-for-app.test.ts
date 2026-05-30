import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listBizprocRobotsForApp } from './list-bizproc-robots-for-app'
import { listInstalledBizprocRobots } from '@/modules/thinkzap/application/list-installed-bizproc-robots.service'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

vi.mock('@/modules/thinkzap/application/list-installed-bizproc-robots.service')
vi.mock('./resolve-bitrix-client-for-app', () => ({
  resolveBitrixClientForApp: vi.fn(),
}))

describe('listBizprocRobotsForApp', () => {
  const client = { callMethod: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveBitrixClientForApp).mockResolvedValue({
      client: client as never,
      domainName: 'empresa.bitrix24.com.br',
    })
    vi.mocked(listInstalledBizprocRobots).mockResolvedValue([
      {
        code: 'thinkzap_robot',
        name: 'ThinkZap Robot',
        isThinkzap: true,
      },
    ])
  })

  it('resolves client and lists bizproc robots', async () => {
    const result = await listBizprocRobotsForApp('app-1')

    expect(resolveBitrixClientForApp).toHaveBeenCalledWith('app-1')
    expect(listInstalledBizprocRobots).toHaveBeenCalledWith(client)
    expect(result.robots).toHaveLength(1)
  })
})
