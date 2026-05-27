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
})
