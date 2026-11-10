import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
const post = vi.fn()
const connect = vi.fn()

vi.mock('./thinkzap-client', () => ({
  resolveThinkzapClient: () => ({ ok: true, client: { get, post } }),
}))

vi.mock('@omnizapi/connect', () => ({
  default: { newClient: () => ({ connect }) },
}))

vi.mock('@/shared/infra/env-config', () => ({
  envConfig: { hubMessagePublicKey: 'pk_1' },
}))

import { connectHubMessageChannel } from './connect-hubmessage-channel'

const ORIGIN = 'https://acme.bitrix24.com.br'

const httpError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status },
  })

const SDK_OK = {
  success: true,
  channelId: 'C-9',
  wabaId: 'W-9',
  phoneId: 'P-9',
  code: 'CODE-9',
}

describe('connectHubMessageChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('window', { location: { origin: ORIGIN } })
    get.mockResolvedValue({ allowed: true })
    post.mockResolvedValue({ connected: true, wabaRecorded: true })
    connect.mockResolvedValue(SDK_OK)
  })

  it('pergunta a origem ao servidor, sem chamar a Omni do navegador', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await connectHubMessageChannel({
      itemId: 'i 1',
      channelId: 'C-9',
    })

    expect(get).toHaveBeenCalledWith(
      '/thinkzap/lines/i%201/connect-origin-check',
      { params: { origin: ORIGIN } },
    )
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result).toEqual({ outcome: 'connected', wabaRecorded: true })
  })

  it('origem não liberada: devolve o desfecho e não abre o SDK', async () => {
    get.mockResolvedValue({ allowed: false })

    const result = await connectHubMessageChannel({
      itemId: 'i1',
      channelId: 'C-9',
    })

    expect(result).toEqual({ outcome: 'origin-not-allowed', origin: ORIGIN })
    expect(connect).not.toHaveBeenCalled()
  })

  it.each([
    ['falha de rede', new Error('Network Error')],
    ['5xx', httpError(502)],
  ])('rota de checagem com %s: segue ao SDK', async (_, error) => {
    get.mockRejectedValue(error)

    const result = await connectHubMessageChannel({
      itemId: 'i1',
      channelId: 'C-9',
    })

    expect(connect).toHaveBeenCalledWith({ channelId: 'C-9' })
    expect(result).toEqual({ outcome: 'connected', wabaRecorded: true })
  })

  it('4xx da checagem (ex.: linha bloqueada) sobe e não abre o SDK', async () => {
    get.mockRejectedValue(httpError(402))

    await expect(
      connectHubMessageChannel({ itemId: 'i1', channelId: 'C-9' }),
    ).rejects.toMatchObject({ response: { status: 402 } })
    expect(connect).not.toHaveBeenCalled()
  })

  it('motivo origin_not_allowed do SDK não vira cancelamento', async () => {
    connect.mockResolvedValue({
      success: false,
      reason: 'origin_not_allowed',
      channelId: 'C-9',
    })

    const result = await connectHubMessageChannel({
      itemId: 'i1',
      channelId: 'C-9',
    })

    expect(result).toEqual({ outcome: 'origin-not-allowed', origin: ORIGIN })
  })

  it('cancelamento do usuário continua sendo cancelled', async () => {
    connect.mockResolvedValue({
      success: false,
      reason: 'popup_closed',
      channelId: 'C-9',
    })

    const result = await connectHubMessageChannel({
      itemId: 'i1',
      channelId: 'C-9',
    })

    expect(result).toEqual({ outcome: 'cancelled' })
  })

  it('retorno sem code: incomplete, sem chamar o servidor', async () => {
    connect.mockResolvedValue({ ...SDK_OK, code: null })

    const result = await connectHubMessageChannel({
      itemId: 'i1',
      channelId: 'C-9',
    })

    expect(result).toEqual({ outcome: 'incomplete' })
    expect(post).not.toHaveBeenCalled()
  })
})
