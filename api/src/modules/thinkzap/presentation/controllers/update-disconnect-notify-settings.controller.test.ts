import type { Request } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { setMock } = vi.hoisted(() => ({ setMock: vi.fn() }))

vi.mock(
  '../../application/thinkzap-disconnect-notify-settings.service',
  () => ({
    ThinkzapDisconnectNotifySettingsService: class {
      set = setMock
    },
  }),
)

import { UpdateDisconnectNotifySettingsController } from './update-disconnect-notify-settings.controller'

const req = (
  over: { thinkzapInstalledAppId?: string; body?: unknown } = {},
): Request =>
  ({
    thinkzapInstalledAppId: 'app-1',
    body: { userIds: [111, 222] },
    ...over,
  }) as unknown as Request

describe('UpdateDisconnectNotifySettingsController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persiste a lista de destinatários e retorna o resultado', async () => {
    setMock.mockResolvedValue([111, 222])
    const controller = new UpdateDisconnectNotifySettingsController(
      {} as never,
    )

    const result = await controller.perform(req())

    expect(setMock).toHaveBeenCalledWith([111, 222])
    expect(result.status).toBe(200)
    expect(result.result).toEqual({ userIds: [111, 222] })
  })

  it('rejeita userIds que não é um array de inteiros', async () => {
    const controller = new UpdateDisconnectNotifySettingsController(
      {} as never,
    )

    const result = await controller.perform(
      req({ body: { userIds: ['abc'] } }),
    )

    expect(result.status).toBe(400)
    expect(setMock).not.toHaveBeenCalled()
  })

  it('rejeita quando o contexto do app não foi resolvido', async () => {
    const controller = new UpdateDisconnectNotifySettingsController(
      {} as never,
    )

    const result = await controller.perform(
      req({ thinkzapInstalledAppId: undefined }),
    )

    expect(result.status).toBe(400)
    expect(setMock).not.toHaveBeenCalled()
  })
})
