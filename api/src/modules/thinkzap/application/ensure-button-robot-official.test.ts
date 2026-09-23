import { describe, expect, it, vi } from 'vitest'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'

const { buttonRobotOfficial } = vi.hoisted(() => ({
  buttonRobotOfficial: {
    code: 'thinkzap_button_robot_official',
    name: 'ThinkZap - Enviar botões (WhatsApp Oficial)',
    handlerUrl: 'https://api.test/thinkzap/bizproc/button-robot-official',
    placementUrl: 'https://app.test/bitrix/bizproc/button-official',
  },
}))

vi.mock('@/config/env', () => ({
  env: { logLevel: 'silent', bitrix: { buttonRobotOfficial } },
}))

import { ensureButtonRobotOfficial } from './ensure-button-robot-official'

describe('ensureButtonRobotOfficial', () => {
  it('registers using the official button robot env config', async () => {
    const callMethod = vi.fn().mockResolvedValue(true)
    const client = { callMethod } as unknown as BitrixRestClient

    const result = await ensureButtonRobotOfficial(client)

    expect(result).toBe('created')
    expect(callMethod).toHaveBeenCalledWith(
      'bizproc.robot.add',
      expect.objectContaining({ CODE: 'thinkzap_button_robot_official' }),
    )
  })
})
