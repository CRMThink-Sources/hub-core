import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'

describe('bitrix-http-request', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses global fetch via custom axios adapter', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ result: true }), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const { createBitrixFetchAdapter } = await import('./bitrix-http-request')
    const adapter = createBitrixFetchAdapter()

    const response = await adapter({
      url: 'https://portal.bitrix24.com.br/rest/placement.get',
      method: 'post',
      headers: { Accept: 'application/json' },
      data: {},
    } as InternalAxiosRequestConfig)

    expect(fetchMock).toHaveBeenCalled()
    expect(response.data).toEqual({ result: true })
  })

  it('wraps fetch network errors as axios network errors', async () => {
    const tlsCause = Object.assign(new Error('tls failed'), {
      code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(tlsCause))

    const { createBitrixFetchAdapter } = await import('./bitrix-http-request')
    const adapter = createBitrixFetchAdapter()

    await expect(
      adapter({
        url: 'https://portal.bitrix24.com.br/rest/placement.get',
        method: 'post',
        headers: {},
        data: {},
      } as InternalAxiosRequestConfig),
    ).rejects.toMatchObject({
      code: 'ERR_NETWORK',
      cause: tlsCause,
    })
  })
})
