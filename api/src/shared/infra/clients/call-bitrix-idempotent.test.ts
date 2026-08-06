import { beforeEach, describe, expect, it, vi } from 'vitest'

const { warnMock, infoMock } = vi.hoisted(() => ({
  warnMock: vi.fn(),
  infoMock: vi.fn(),
}))

vi.mock('@/shared/infra/logger', () => ({
  logger: { warn: warnMock, info: infoMock },
}))

import { BitrixApiError } from './bitrix-api.error'
import { callBitrixIdempotent } from './call-bitrix-idempotent'

function clientThatFailsWith(error: unknown) {
  return { callMethod: vi.fn().mockRejectedValue(error) }
}

describe('callBitrixIdempotent', () => {
  beforeEach(() => {
    warnMock.mockReset()
    infoMock.mockReset()
  })

  it('repassa método e params ao cliente', async () => {
    const client = { callMethod: vi.fn().mockResolvedValue({}) }

    await callBitrixIdempotent(client, 'event.bind', { event: 'ONX' })

    expect(client.callMethod).toHaveBeenCalledWith('event.bind', {
      event: 'ONX',
    })
  })

  it('não loga nada quando a chamada dá certo', async () => {
    const client = { callMethod: vi.fn().mockResolvedValue({}) }

    await callBitrixIdempotent(client, 'event.bind', {})

    expect(warnMock).not.toHaveBeenCalled()
    expect(infoMock).not.toHaveBeenCalled()
  })

  it('trata código idempotente como sucesso', async () => {
    const client = clientThatFailsWith(
      new BitrixApiError(
        'event.bind',
        'ERROR_EVENT_BINDING_EXISTS',
        'Handler already binded',
        'Bitrix event.bind: Handler already binded',
      ),
    )

    await expect(
      callBitrixIdempotent(client, 'event.bind', {}),
    ).resolves.toBeUndefined()
  })

  it('ignora caixa do código', async () => {
    const client = clientThatFailsWith(
      new BitrixApiError(
        'placement.bind',
        'error_placement_already_binded',
        '',
        'x',
      ),
    )

    await expect(
      callBitrixIdempotent(client, 'placement.bind', {}),
    ).resolves.toBeUndefined()
  })

  it('propaga código do Bitrix fora da lista', async () => {
    const error = new BitrixApiError(
      'placement.bind',
      'ACCESS_DENIED',
      'Access denied!',
      'Bitrix placement.bind: Access denied!',
    )
    const client = clientThatFailsWith(error)

    await expect(
      callBitrixIdempotent(client, 'placement.bind', {}),
    ).rejects.toBe(error)
  })

  it('propaga erro que não vem da API do Bitrix (rede, TLS)', async () => {
    const error = new Error('socket hang up')
    const client = clientThatFailsWith(error)

    await expect(callBitrixIdempotent(client, 'event.bind', {})).rejects.toBe(
      error,
    )
  })

  it('loga o código antes de classificar, para que código ausente seja diagnosticável', async () => {
    const client = clientThatFailsWith(
      new BitrixApiError('imconnector.register', 'SOME_UNKNOWN_CODE', '', 'x'),
    )

    await expect(
      callBitrixIdempotent(client, 'imconnector.register', {}),
    ).rejects.toBeInstanceOf(BitrixApiError)

    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'imconnector.register',
        code: 'SOME_UNKNOWN_CODE',
      }),
      expect.any(String),
    )
  })
})
