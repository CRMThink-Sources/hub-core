import { describe, expect, it, vi } from 'vitest'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'

const { buttonRobotUnofficial } = vi.hoisted(() => ({
  buttonRobotUnofficial: {
    code: 'thinkzap_button_robot_unofficial',
    name: 'ThinkZap - Enviar botões (Z-API)',
    handlerUrl: 'https://api.test/thinkzap/bizproc/button-robot-unofficial',
    placementUrl: 'https://app.test/bitrix/bizproc/button-unofficial',
  },
}))

vi.mock('@/config/env', () => ({
  env: { logLevel: 'silent', bitrix: { buttonRobotUnofficial } },
}))

import { ensureButtonRobotUnofficial } from './ensure-button-robot-unofficial'

describe('ensureButtonRobotUnofficial', () => {
  it('registers using the unofficial button robot env config', async () => {
    const callMethod = vi.fn().mockResolvedValue(true)
    const client = { callMethod } as unknown as BitrixRestClient

    const result = await ensureButtonRobotUnofficial(client)

    expect(result).toBe('created')
    expect(callMethod).toHaveBeenCalledWith(
      'bizproc.robot.add',
      expect.objectContaining({ CODE: 'thinkzap_button_robot_unofficial' }),
    )
  })
})
