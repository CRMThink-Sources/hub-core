import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { EnsureThinkzapRobot } from './ensure-thinkzap-robot'

vi.mock('./build-thinkzap-robot-add-params', () => ({
  buildThinkzapRobotAddParams: () => ({
    CODE: 'thinkzap_robot',
    HANDLER: 'https://app.example/robot',
    USE_SUBSCRIPTION: 'N',
    NAME: 'ThinkZap Robot',
    PROPERTIES: {},
  }),
  buildThinkzapRobotUpdateParams: () => ({
    CODE: 'thinkzap_robot',
    FIELDS: {
      PROPERTIES: {},
    },
  }),
}))

describe('EnsureThinkzapRobot', () => {
  const callMethod = vi.fn()
  const client = { callMethod } as unknown as BitrixRestClient
  const service = new EnsureThinkzapRobot()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers robot when add succeeds', async () => {
    callMethod.mockResolvedValueOnce(true)

    const result = await service.execute(client)

    expect(result).toBe('created')
    expect(callMethod).toHaveBeenCalledWith(
      'bizproc.robot.add',
      expect.objectContaining({ CODE: 'thinkzap_robot' }),
    )
  })

  it('updates robot when add indicates duplicate', async () => {
    callMethod
      .mockRejectedValueOnce(new Error('ERROR_ACTIVITY_VALIDATION_FAILURE'))
      .mockResolvedValueOnce(true)

    const result = await service.execute(client)

    expect(result).toBe('updated')
    expect(callMethod).toHaveBeenNthCalledWith(
      2,
      'bizproc.robot.update',
      expect.objectContaining({ CODE: 'thinkzap_robot' }),
    )
  })

  it('returns skipped when add returns false', async () => {
    callMethod.mockResolvedValueOnce(false)

    const result = await service.execute(client)

    expect(result).toBe('skipped')
  })
})
