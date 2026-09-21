import type { Request } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))

vi.mock(
  '../../application/thinkzap-disconnect-notify-settings.service',
  () => ({
    ThinkzapDisconnectNotifySettingsService: class {
      get = getMock
    },
  }),
)

import { GetDisconnectNotifySettingsController } from './get-disconnect-notify-settings.controller'

const req = (over: { thinkzapInstalledAppId?: string } = {}): Request =>
  ({ thinkzapInstalledAppId: 'app-1', ...over }) as unknown as Request

describe('GetDisconnectNotifySettingsController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna a lista de destinatários configurada', async () => {
    getMock.mockResolvedValue([111, 222])
    const controller = new GetDisconnectNotifySettingsController({} as never)

    const result = await controller.perform(req())

    expect(result.status).toBe(200)
    expect(result.result).toEqual({ userIds: [111, 222] })
  })

  it('rejeita quando o contexto do app não foi resolvido', async () => {
    const controller = new GetDisconnectNotifySettingsController({} as never)

    const result = await controller.perform(
      req({ thinkzapInstalledAppId: undefined }),
    )

    expect(result.status).toBe(400)
    expect(getMock).not.toHaveBeenCalled()
  })
})
