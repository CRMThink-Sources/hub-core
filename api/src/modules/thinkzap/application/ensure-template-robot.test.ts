import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { BitrixApiError } from '@/shared/infra/clients/bitrix-api.error'

const { addParams } = vi.hoisted(() => ({
  addParams: {
    CODE: 'thinkzap_template_robot',
    HANDLER: 'https://api.test/thinkzap/bizproc/template-robot',
    NAME: 'ThinkZap - Enviar template',
    USE_SUBSCRIPTION: 'N',
    USE_PLACEMENT: 'Y',
    PLACEMENT_HANDLER: 'https://app.test/bitrix/bizproc/template',
    PROPERTIES: {},
  },
}))

vi.mock('./build-template-robot-params', () => ({
  buildTemplateRobotAddParams: () => addParams,
  buildTemplateRobotUpdateParams: () => ({
    CODE: 'thinkzap_template_robot',
    FIELDS: { PROPERTIES: {}, USE_PLACEMENT: 'Y' },
  }),
}))

import { EnsureTemplateRobot } from './ensure-template-robot'

describe('EnsureTemplateRobot', () => {
  const callMethod = vi.fn()
  const client = { callMethod } as unknown as BitrixRestClient
  const service = new EnsureTemplateRobot()

  beforeEach(() => {
    vi.clearAllMocks()
    addParams.HANDLER = 'https://api.test/thinkzap/bizproc/template-robot'
  })

  it('registers the robot with the placement screen when add succeeds', async () => {
    callMethod.mockResolvedValueOnce(true)

    const result = await service.execute(client)

    expect(result).toBe('created')
    expect(callMethod).toHaveBeenCalledWith(
      'bizproc.robot.add',
      expect.objectContaining({
        CODE: 'thinkzap_template_robot',
        USE_PLACEMENT: 'Y',
      }),
    )
  })

  it('converges the definition when the robot already exists', async () => {
    callMethod
      .mockRejectedValueOnce(new Error('ERROR_ACTIVITY_VALIDATION_FAILURE'))
      .mockResolvedValueOnce(true)

    const result = await service.execute(client)

    expect(result).toBe('updated')
    expect(callMethod).toHaveBeenNthCalledWith(
      2,
      'bizproc.robot.update',
      expect.objectContaining({ CODE: 'thinkzap_template_robot' }),
    )
  })

  it('converges when the description is translated and has no marker, by code', async () => {
    callMethod
      .mockRejectedValueOnce(
        new BitrixApiError(
          'bizproc.robot.add',
          'ERROR_ACTIVITY_VALIDATION_FAILURE',
          'Ya existe un robot con este código',
          'Bitrix bizproc.robot.add: Ya existe un robot con este código',
        ),
      )
      .mockResolvedValueOnce(true)

    const result = await service.execute(client)

    expect(result).toBe('updated')
  })

  // Robô sem handler ficaria configurável no portal e morreria em 404 no disparo.
  it('registers nothing when no handler is configured', async () => {
    addParams.HANDLER = ''

    const result = await service.execute(client)

    expect(result).toBe('skipped')
    expect(callMethod).not.toHaveBeenCalled()
  })

  it('returns skipped when add returns false', async () => {
    callMethod.mockResolvedValueOnce(false)

    expect(await service.execute(client)).toBe('skipped')
  })

  it('propagates errors that are not a duplicate robot', async () => {
    callMethod.mockRejectedValueOnce(new Error('Access denied!'))

    await expect(service.execute(client)).rejects.toThrow('Access denied!')
    expect(callMethod).toHaveBeenCalledTimes(1)
  })
})
