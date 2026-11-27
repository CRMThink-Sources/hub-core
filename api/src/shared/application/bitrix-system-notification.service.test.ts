import { describe, expect, it, vi } from 'vitest'
import { BitrixMethodPausedError } from '../infra/bitrix-limits/bitrix-limits.port'
import type { BitrixClient } from '../infra/clients/bitrix.client'
import { BitrixSystemNotificationService } from './bitrix-system-notification.service'

type CallMethod = BitrixClient['callMethod']

function setup(failure?: Error) {
  const callMethod = vi.fn<CallMethod>()
  if (failure) callMethod.mockRejectedValue(failure)
  else callMethod.mockResolvedValue({ result: 1 } as never)
  const service = new BitrixSystemNotificationService({
    callMethod,
  } as unknown as BitrixClient)
  return { service, callMethod }
}

const input = { userId: 7, message: 'oi', tag: 't' }
const paused = () =>
  new BitrixMethodPausedError('im.notify.system.add', 'x', Date.now() + 60_000)

describe('BitrixSystemNotificationService', () => {
  it('notify engole a pausa, como os outros chamadores esperam', async () => {
    const { service } = setup(paused())

    await expect(service.notify(input)).resolves.toBe(false)
  })

  it('notifyOrDefer deixa subir a pausa, para quem chamou reagendar', async () => {
    const refusal = paused()
    const { service } = setup(refusal)

    await expect(service.notifyOrDefer(input)).rejects.toBe(refusal)
  })

  it('notifyOrDefer deixa subir a recusa por intensidade', async () => {
    const { service } = setup(
      new Error('Bitrix error: 503 - {"error":"QUERY_LIMIT_EXCEEDED"}'),
    )

    await expect(service.notifyOrDefer(input)).rejects.toThrow(
      'QUERY_LIMIT_EXCEEDED',
    )
  })

  it('notifyOrDefer devolve false em outra falha', async () => {
    const { service } = setup(new Error('sem escopo im'))

    await expect(service.notifyOrDefer(input)).resolves.toBe(false)
  })

  it('notifyOrDefer devolve true quando o Bitrix aceita', async () => {
    const { service, callMethod } = setup()

    await expect(service.notifyOrDefer(input)).resolves.toBe(true)
    expect(callMethod).toHaveBeenCalledWith('im.notify.system.add', {
      USER_ID: 7,
      MESSAGE: 'oi',
      TAG: 't',
    })
  })
})
