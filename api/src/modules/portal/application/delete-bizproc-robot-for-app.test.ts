import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteBizprocRobotForApp } from './delete-bizproc-robot-for-app'
import { deleteThinkzapRobot } from '@/modules/thinkzap/application/delete-thinkzap-robot'
import { deleteTemplateRobot } from '@/modules/thinkzap/application/delete-template-robot'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

vi.mock('@/modules/thinkzap/application/delete-thinkzap-robot')
vi.mock('@/modules/thinkzap/application/delete-template-robot')
vi.mock('./resolve-bitrix-client-for-app', () => ({
  resolveBitrixClientForApp: vi.fn(),
}))
vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
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
    vi.mocked(deleteTemplateRobot).mockResolvedValue('deleted')
  })

  it('resolves client and deletes both bizproc robots', async () => {
    const result = await deleteBizprocRobotForApp('app-1')

    expect(resolveBitrixClientForApp).toHaveBeenCalledWith('app-1')
    expect(deleteThinkzapRobot).toHaveBeenCalledWith(client)
    expect(deleteTemplateRobot).toHaveBeenCalledWith(client)
    expect(result).toEqual({ result: 'deleted', templateResult: 'deleted' })
  })

  // Rollback tem de ser repetível: portal onde o robô novo nunca foi registrado não
  // é erro.
  it('reports the template robot as missing without failing', async () => {
    vi.mocked(deleteTemplateRobot).mockResolvedValue('not_found')

    const result = await deleteBizprocRobotForApp('app-1')

    expect(result).toEqual({ result: 'deleted', templateResult: 'not_found' })
  })

  it('deletes the free-send robot even when the template robot fails', async () => {
    vi.mocked(deleteTemplateRobot).mockRejectedValue(
      new Error('Access denied!'),
    )

    const result = await deleteBizprocRobotForApp('app-1')

    expect(deleteThinkzapRobot).toHaveBeenCalledWith(client)
    expect(result).toEqual({ result: 'deleted', templateResult: 'failed' })
  })
})
