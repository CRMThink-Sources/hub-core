import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  VibecodeAuthError,
  VibecodeClient,
  VibecodeRequestError,
} from './vibecode.client'

const createSpy = vi.hoisted(() => vi.fn())
const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('axios', () => {
  createSpy.mockImplementation(() => http)
  return {
    default: {
      create: createSpy,
      isAxiosError: (e: unknown) =>
        typeof e === 'object' && e !== null && 'isAxiosError' in e,
    },
  }
})

function instance() {
  return createSpy.mock.results[0]?.value as {
    get: ReturnType<typeof vi.fn>
    post: ReturnType<typeof vi.fn>
  }
}

const KEY = 'vibe_secret_key_123456'
const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve())

describe('VibecodeClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // clearAllMocks não limpa implementações: com retentativa, um mock fixo
    // de teste anterior vazaria para as tentativas seguintes.
    http.get.mockReset()
    http.post.mockReset()
  })

  it('envia X-Api-Key e devolve data do /me', async () => {
    const client = new VibecodeClient(KEY)
    instance().get.mockResolvedValue({
      data: { success: true, data: { type: 'personal', scopes: [] } },
    })

    const me = await client.me()

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://vibecode.bitrix24.com/v1',
        headers: { 'X-Api-Key': KEY },
        timeout: 15000,
      }),
    )
    expect(instance().get).toHaveBeenCalledWith('/me')
    expect(me).toEqual({ type: 'personal', scopes: [] })
  })

  it('lança VibecodeAuthError em 401', async () => {
    const client = new VibecodeClient(KEY)
    instance().get.mockRejectedValue({
      isAxiosError: true,
      message: 'Request failed with status code 401',
      response: { status: 401 },
    })

    await expect(client.get('/x')).rejects.toBeInstanceOf(VibecodeAuthError)
  })

  it('lança VibecodeAuthError quando success é false', async () => {
    const client = new VibecodeClient(KEY)
    instance().post.mockResolvedValue({ data: { success: false } })

    await expect(client.post('/x', {})).rejects.toBeInstanceOf(
      VibecodeAuthError,
    )
  })

  it('guarda o status HTTP na recusa para distinguir chave revogada', async () => {
    const client = new VibecodeClient(KEY)
    instance().get.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403 },
    })

    const err = await client.get('/x').catch((e: unknown) => e)

    expect(err).toBeInstanceOf(VibecodeAuthError)
    expect((err as VibecodeAuthError).status).toBe(403)
  })

  it('success false sem 401/403 não traz status', async () => {
    const client = new VibecodeClient(KEY)
    instance().get.mockResolvedValue({ data: { success: false } })

    const err = await client.get('/x').catch((e: unknown) => e)

    expect(err).toBeInstanceOf(VibecodeAuthError)
    expect((err as VibecodeAuthError).status).toBeUndefined()
  })

  it('falha 5xx vira VibecodeRequestError, não recusa de chave', async () => {
    const client = new VibecodeClient(KEY, sleep)
    instance().get.mockRejectedValue({
      isAxiosError: true,
      response: { status: 502 },
    })

    const err = await client.get('/x').catch((e: unknown) => e)

    expect(err).toBeInstanceOf(VibecodeRequestError)
    expect((err as Error).message).toBe('Falha ao chamar a Vibecode (502)')
  })

  it('VibecodeRequestError guarda status HTTP e code do axios', async () => {
    const client = new VibecodeClient(KEY, sleep)
    instance().get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 500 },
    })
    instance().get.mockRejectedValue({
      isAxiosError: true,
      code: 'ECONNABORTED',
    })

    const http = (await client
      .get('/x')
      .catch((e: unknown) => e)) as VibecodeRequestError
    const net = (await client
      .get('/x')
      .catch((e: unknown) => e)) as VibecodeRequestError

    expect(http.status).toBe(500)
    expect(http.code).toBeUndefined()
    expect(net.status).toBeUndefined()
    expect(net.code).toBe('ECONNABORTED')
  })

  it('getPage e postPage devolvem data e meta (paginação)', async () => {
    const client = new VibecodeClient(KEY)
    instance().get.mockResolvedValue({
      data: { success: true, data: [1], meta: { hasMore: true } },
    })
    instance().post.mockResolvedValue({
      data: { success: true, data: [2] },
    })

    await expect(client.getPage('/a')).resolves.toEqual({
      data: [1],
      meta: { hasMore: true },
    })
    await expect(client.postPage('/b', { x: 1 })).resolves.toEqual({
      data: [2],
      meta: undefined,
    })
    expect(instance().post).toHaveBeenCalledWith('/b', { x: 1 })
  })

  describe('retentativa', () => {
    const fail = (status?: number, headers?: Record<string, string>) => ({
      isAxiosError: true,
      response: status === undefined ? undefined : { status, headers },
    })
    const ok = { data: { success: true, data: { ok: 1 } } }

    it('retenta 429 e sucede na segunda tentativa', async () => {
      const client = new VibecodeClient(KEY, sleep)
      instance().get.mockRejectedValueOnce(fail(429)).mockResolvedValue(ok)

      await expect(client.get('/x')).resolves.toEqual({ ok: 1 })

      expect(instance().get).toHaveBeenCalledTimes(2)
      expect(sleep).toHaveBeenCalledWith(400)
    })

    it('retenta falha sem resposta (timeout) com backoff crescente', async () => {
      const client = new VibecodeClient(KEY, sleep)
      instance()
        .get.mockRejectedValueOnce(fail())
        .mockRejectedValueOnce(fail())
        .mockResolvedValue(ok)

      await expect(client.get('/x')).resolves.toEqual({ ok: 1 })

      expect(sleep.mock.calls).toEqual([[400], [1200]])
    })

    it('respeita Retry-After em segundos, com teto de 5 s', async () => {
      const client = new VibecodeClient(KEY, sleep)
      instance()
        .get.mockRejectedValueOnce(fail(429, { 'retry-after': '2' }))
        .mockRejectedValueOnce(fail(503, { 'retry-after': '60' }))
        .mockResolvedValue(ok)

      await client.get('/x')

      expect(sleep.mock.calls).toEqual([[2000], [5000]])
    })

    it('esgota as 2 retentativas e lança VibecodeRequestError com o status', async () => {
      const client = new VibecodeClient(KEY, sleep)
      instance().post.mockRejectedValue(fail(503))

      const err = await client.post('/x', {}).catch((e: unknown) => e)

      expect(err).toBeInstanceOf(VibecodeRequestError)
      expect((err as VibecodeRequestError).status).toBe(503)
      expect(instance().post).toHaveBeenCalledTimes(3)
    })

    it.each([401, 403, 400, 404])('não retenta %i', async status => {
      const client = new VibecodeClient(KEY, sleep)
      instance().get.mockRejectedValue(fail(status))

      await client.get('/x').catch(() => undefined)

      expect(instance().get).toHaveBeenCalledTimes(1)
      expect(sleep).not.toHaveBeenCalled()
    })

    it('me() não retenta', async () => {
      const client = new VibecodeClient(KEY, sleep)
      instance().get.mockRejectedValue(fail(503))

      await expect(client.me()).rejects.toBeInstanceOf(VibecodeRequestError)

      expect(instance().get).toHaveBeenCalledTimes(1)
      expect(sleep).not.toHaveBeenCalled()
    })
  })

  it('a mensagem de erro não contém a chave', async () => {
    const client = new VibecodeClient(KEY)
    instance().get.mockRejectedValue({
      isAxiosError: true,
      message: `falhou com header ${KEY}`,
      response: { status: 500 },
      config: { headers: { 'X-Api-Key': KEY } },
    })

    const err = await client.get('/x').catch((e: Error) => e)

    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).not.toContain(KEY)
  })
})
