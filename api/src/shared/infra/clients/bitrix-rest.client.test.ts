import axios from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { BitrixRestClient } from './bitrix-rest.client'

describe('BitrixRestClient', () => {
  it('formats ACCESS_DENIED from axios response with scope hint', async () => {
    const post = vi.fn().mockRejectedValue(
      new axios.AxiosError(
        'Forbidden',
        'ERR_BAD_REQUEST',
        undefined,
        undefined,
        {
          status: 403,
          data: {
            error: 'ACCESS_DENIED',
            error_description: 'Access denied!',
          },
          statusText: 'Forbidden',
          headers: {},
          config: {} as never,
        },
      ),
    )

    vi.spyOn(axios, 'create').mockReturnValue({ post } as never)

    const client = new BitrixRestClient('portal.bitrix24.com.br', 'token')

    await expect(client.callMethod('placement.bind', {})).rejects.toThrow(
      /scope im/i,
    )
  })

  it('names the scope the failing method needs, not always `im`', async () => {
    // Dica com o escopo errado manda o cliente conferir uma permissão que ele já tem e
    // concluir que o problema é outro.
    const post = vi.fn().mockRejectedValue(
      new axios.AxiosError(
        'Forbidden',
        'ERR_BAD_REQUEST',
        undefined,
        undefined,
        {
          status: 403,
          data: { error: 'ACCESS_DENIED', error_description: 'Access denied!' },
          statusText: 'Forbidden',
          headers: {},
          config: {} as never,
        },
      ),
    )

    vi.spyOn(axios, 'create').mockReturnValue({ post } as never)

    const client = new BitrixRestClient('portal.bitrix24.com.br', 'token')

    await expect(
      client.callMethod('imbot.v2.Bot.register', {}),
    ).rejects.toThrow(/scope imbot/i)
  })

  it('keeps `im` for methods whose scope is not their prefix', async () => {
    // `placement.bind` exige `im` e `imconnector.register` exige `imopenlines`: deduzir o
    // escopo do nome do método erraria os dois, e a dica errada custa mais que a genérica.
    const post = vi.fn().mockRejectedValue(
      new axios.AxiosError(
        'Forbidden',
        'ERR_BAD_REQUEST',
        undefined,
        undefined,
        {
          status: 403,
          data: { error: 'insufficient_scope' },
          statusText: 'Forbidden',
          headers: {},
          config: {} as never,
        },
      ),
    )

    vi.spyOn(axios, 'create').mockReturnValue({ post } as never)

    const client = new BitrixRestClient('portal.bitrix24.com.br', 'token')

    await expect(client.callMethod('placement.bind', {})).rejects.toThrow(
      /scope im no app/i,
    )
  })

  it('formats TLS certificate errors with env hint', async () => {
    const tlsError = new axios.AxiosError(
      'unable to verify the first certificate',
      'ERR_BAD_REQUEST',
    )
    tlsError.cause = {
      code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    } as unknown as Error

    const post = vi.fn().mockRejectedValue(tlsError)

    vi.spyOn(axios, 'create').mockReturnValue({ post } as never)

    const client = new BitrixRestClient('portal.bitrix24.com.br', 'token')

    await expect(client.callMethod('placement.get', {})).rejects.toThrow(
      /BITRIX_TLS_REJECT_UNAUTHORIZED=false/i,
    )
  })
})
