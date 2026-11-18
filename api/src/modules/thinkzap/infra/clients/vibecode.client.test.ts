import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VibecodeAuthError, VibecodeClient } from './vibecode.client'

const createSpy = vi.hoisted(() => vi.fn())

vi.mock('axios', () => {
  const instance = { get: vi.fn(), post: vi.fn() }
  createSpy.mockImplementation(() => instance)
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

describe('VibecodeClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
