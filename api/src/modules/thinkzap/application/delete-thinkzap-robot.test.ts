import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { deleteThinkzapRobot } from './delete-thinkzap-robot'

vi.mock('@/config/env', () => ({
  env: {
    bitrix: {
      robot: {
        code: 'thinkzap_robot',
      },
    },
  },
}))

describe('deleteThinkzapRobot', () => {
  const callMethod = vi.fn()
  const client = { callMethod } as unknown as BitrixRestClient

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes robot by code', async () => {
    callMethod.mockResolvedValue(true)

    const result = await deleteThinkzapRobot(client)

    expect(result).toBe('deleted')
    expect(callMethod).toHaveBeenCalledWith('bizproc.robot.delete', {
      CODE: 'thinkzap_robot',
    })
  })

  it('returns not_found when robot does not exist', async () => {
    callMethod.mockRejectedValue(
      new Error('ERROR_ACTIVITY_NOT_FOUND: Activity or Robot not found!'),
    )

    const result = await deleteThinkzapRobot(client)

    expect(result).toBe('not_found')
  })
})
