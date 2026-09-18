import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { BitrixApiError } from '@/shared/infra/clients/bitrix-api.error'
import { EnsureButtonRobot } from './ensure-button-robot'

const config = () => ({
  code: 'thinkzap_button_robot_official',
  name: 'ThinkZap - Enviar botões (WhatsApp Oficial)',
  handlerUrl: 'https://api.test/thinkzap/bizproc/button-robot-official',
  placementUrl: 'https://app.test/bitrix/bizproc/button-official',
})

describe('EnsureButtonRobot', () => {
  const callMethod = vi.fn()
  const client = { callMethod } as unknown as BitrixRestClient

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers the robot with the placement screen when add succeeds', async () => {
    callMethod.mockResolvedValueOnce(true)
    const service = new EnsureButtonRobot(config(), 'descrição')

    const result = await service.execute(client)

    expect(result).toBe('created')
    expect(callMethod).toHaveBeenCalledWith(
      'bizproc.robot.add',
      expect.objectContaining({
        CODE: 'thinkzap_button_robot_official',
        DESCRIPTION: 'descrição',
        USE_PLACEMENT: 'Y',
      }),
    )
  })

  it('converges the definition when the robot already exists', async () => {
    callMethod
      .mockRejectedValueOnce(new Error('ERROR_ACTIVITY_VALIDATION_FAILURE'))
      .mockResolvedValueOnce(true)
    const service = new EnsureButtonRobot(config(), 'descrição')

    const result = await service.execute(client)

    expect(result).toBe('updated')
    expect(callMethod).toHaveBeenNthCalledWith(
      2,
      'bizproc.robot.update',
      expect.objectContaining({ CODE: 'thinkzap_button_robot_official' }),
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
    const service = new EnsureButtonRobot(config(), 'descrição')

    const result = await service.execute(client)

    expect(result).toBe('updated')
  })

  it('registers nothing when no handler is configured', async () => {
    const service = new EnsureButtonRobot(
      { ...config(), handlerUrl: '' },
      'descrição',
    )

    const result = await service.execute(client)

    expect(result).toBe('skipped')
    expect(callMethod).not.toHaveBeenCalled()
  })

  it('returns skipped when add returns false', async () => {
    callMethod.mockResolvedValueOnce(false)
    const service = new EnsureButtonRobot(config(), 'descrição')

    expect(await service.execute(client)).toBe('skipped')
  })

  it('propagates errors that are not a duplicate robot', async () => {
    callMethod.mockRejectedValueOnce(new Error('Access denied!'))
    const service = new EnsureButtonRobot(config(), 'descrição')

    await expect(service.execute(client)).rejects.toThrow('Access denied!')
    expect(callMethod).toHaveBeenCalledTimes(1)
  })
})
