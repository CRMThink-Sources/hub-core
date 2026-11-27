import { describe, expect, it, vi } from 'vitest'
import { BitrixSendSenderNamesAdapter } from '@/modules/thinkzap/infra/adapters/bitrix-send-sender-names.adapter'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'

const clientWith = (callMethod: BitrixClient['callMethod']) =>
  ({ callMethod }) as unknown as BitrixClient

describe('BitrixSendSenderNamesAdapter', () => {
  it('resolve vários usuários em um user.get com FILTER por ID', async () => {
    const callMethod = vi.fn().mockResolvedValue({
      result: [
        { ID: '1', NAME: 'Ana', LAST_NAME: 'Souza' },
        { ID: 2, NAME: 'Bruno' },
        { ID: '3' },
      ],
    })
    const sut = new BitrixSendSenderNamesAdapter(clientWith(callMethod))

    const names = await sut.resolveNames(['1', '2', '3'])

    expect(callMethod).toHaveBeenCalledTimes(1)
    expect(callMethod).toHaveBeenCalledWith('user.get', {
      FILTER: { ID: ['1', '2', '3'] },
    })
    expect([...names]).toEqual([
      ['1', 'Ana Souza'],
      ['2', 'Bruno'],
    ])
  })

  it('divide em páginas de 50 quando há mais ids', async () => {
    const callMethod = vi.fn().mockResolvedValue({ result: [] })
    const sut = new BitrixSendSenderNamesAdapter(clientWith(callMethod))

    await sut.resolveNames(Array.from({ length: 51 }, (_, i) => String(i)))

    expect(callMethod).toHaveBeenCalledTimes(2)
  })

  it('propaga a falha do Bitrix para o caso de uso tolerar', async () => {
    const callMethod = vi.fn().mockRejectedValue(new Error('Bitrix 503'))
    const sut = new BitrixSendSenderNamesAdapter(clientWith(callMethod))

    await expect(sut.resolveNames(['1'])).rejects.toThrow('Bitrix 503')
  })
})
