import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { ListInstalledBizprocRobotsService } from './list-installed-bizproc-robots.service'

vi.mock('@/config/env', () => ({
  env: {
    bitrix: {
      robot: {
        code: 'thinkzap_robot',
        name: 'ThinkZap Robot',
      },
      templateRobot: {
        code: 'thinkzap_template_robot',
        name: 'ThinkZap Template',
      },
      buttonRobotOfficial: {
        code: 'thinkzap_button_robot_official',
        name: 'ThinkZap Botões (Oficial)',
      },
      buttonRobotUnofficial: {
        code: 'thinkzap_button_robot_unofficial',
        name: 'ThinkZap Botões (Z-API)',
      },
    },
  },
}))

describe('ListInstalledBizprocRobotsService', () => {
  const callMethod = vi.fn()
  const client = { callMethod } as unknown as BitrixRestClient
  const service = new ListInstalledBizprocRobotsService()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('propagates error when bizproc.robot.list fails', async () => {
    callMethod.mockRejectedValue(new Error('fail'))

    await expect(service.execute(client)).rejects.toThrow('fail')
  })

  it('maps robot codes and flags thinkzap robot', async () => {
    callMethod.mockResolvedValue(['other_robot', 'thinkzap_robot'])

    const result = await service.execute(client)

    expect(result).toEqual([
      {
        code: 'other_robot',
        name: null,
        isThinkzap: false,
      },
      {
        code: 'thinkzap_robot',
        name: 'ThinkZap Robot',
        isThinkzap: true,
      },
    ])
  })

  it('handles wrapped result array', async () => {
    callMethod.mockResolvedValue({ result: ['thinkzap_robot'] })

    const result = await service.execute(client)

    expect(result).toEqual([
      {
        code: 'thinkzap_robot',
        name: 'ThinkZap Robot',
        isThinkzap: true,
      },
    ])
  })

  it('flags template and button robots as thinkzap too', async () => {
    callMethod.mockResolvedValue([
      'thinkzap_template_robot',
      'thinkzap_button_robot_official',
      'thinkzap_button_robot_unofficial',
      'other_robot',
    ])

    const result = await service.execute(client)

    expect(result).toEqual([
      {
        code: 'other_robot',
        name: null,
        isThinkzap: false,
      },
      {
        code: 'thinkzap_button_robot_official',
        name: 'ThinkZap Botões (Oficial)',
        isThinkzap: true,
      },
      {
        code: 'thinkzap_button_robot_unofficial',
        name: 'ThinkZap Botões (Z-API)',
        isThinkzap: true,
      },
      {
        code: 'thinkzap_template_robot',
        name: 'ThinkZap Template',
        isThinkzap: true,
      },
    ])
  })
})
