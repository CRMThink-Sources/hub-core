import axios, { type AxiosAdapter, type AxiosInstance } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachBitrixLimits, methodFromUrl } from './attach-bitrix-limits'
import {
  BitrixMethodPausedError,
  resetBitrixLimitsForTests,
  setBitrixLimits,
} from './bitrix-limits.port'
import { InMemoryBitrixLimits } from './in-memory-bitrix-limits'
import { DEFAULT_BUCKET_LIMITS } from './leaky-bucket'

/**
 * Adapter no lugar de rede: o que se mede aqui é a decisão do interceptor —
 * quantas vezes ele repetiu, quando desistiu, quando pausou — não o HTTP.
 */
type Reply =
  | { status: 200; data: unknown }
  | { status: number; data: unknown; fail: true }

function makeClient(replies: Reply[]): {
  client: AxiosInstance
  calls: () => number
} {
  let call = 0

  const adapter: AxiosAdapter = config => {
    const reply = replies[Math.min(call, replies.length - 1)]!
    call += 1

    const response = {
      status: reply.status,
      statusText: '',
      data: reply.data,
      headers: {},
      config,
    }

    if ('fail' in reply) {
      const error = new axios.AxiosError('falhou', 'ERR', config, undefined, {
        ...response,
        headers: {},
      } as never)
      return Promise.reject(error)
    }

    return Promise.resolve(response as never)
  }

  return {
    client: attachBitrixLimits(
      axios.create({
        baseURL: 'https://portal.bitrix24.com.br/rest/',
        adapter,
      }),
      'portal.bitrix24.com.br',
    ),
    calls: () => call,
  }
}

/** Espera instantânea: o teste mede a decisão, não o relógio. */
function stubSleep() {
  vi.stubGlobal('setTimeout', ((fn: () => void) => {
    fn()
    return 0
  }) as unknown as typeof setTimeout)
}

afterEach(() => {
  resetBitrixLimitsForTests()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('methodFromUrl', () => {
  it('extrai o método do path', () => {
    expect(methodFromUrl('/imbot.v2.Bot.list')).toBe('imbot.v2.Bot.list')
    expect(methodFromUrl('imopenlines.config.get?CONFIG_ID=1')).toBe(
      'imopenlines.config.get',
    )
  })

  it('sem url não inventa método', () => {
    expect(methodFromUrl(undefined)).toBe('unknown')
  })
})

describe('attachBitrixLimits', () => {
  it('sem domínio devolve a instância intacta', () => {
    const instance = axios.create()

    expect(attachBitrixLimits(instance, undefined)).toBe(instance)
    expect(instance.interceptors.request.handlers).toHaveLength(0)
  })

  it('axios mockado sem interceptors passa sem quebrar', () => {
    const fake = { post: () => undefined } as unknown as AxiosInstance

    expect(attachBitrixLimits(fake, 'portal.bitrix24.com.br')).toBe(fake)
  })

  it('chamada normal passa e devolve o corpo', async () => {
    const { client, calls } = makeClient([{ status: 200, data: { result: 1 } }])

    const response = await client.post('/user.get', {})

    expect(response.data).toEqual({ result: 1 })
    expect(calls()).toBe(1)
  })

  it('503 QUERY_LIMIT_EXCEEDED é repetido até passar', async () => {
    stubSleep()
    const { client, calls } = makeClient([
      { status: 503, data: { error: 'QUERY_LIMIT_EXCEEDED' }, fail: true },
      { status: 503, data: { error: 'QUERY_LIMIT_EXCEEDED' }, fail: true },
      { status: 200, data: { result: 'ok' } },
    ])

    const response = await client.post('/user.get', {})

    expect(response.data).toEqual({ result: 'ok' })
    expect(calls()).toBe(3)
  })

  it('503 que não cede desiste depois das retentativas', async () => {
    stubSleep()
    const { client, calls } = makeClient([
      { status: 503, data: { error: 'QUERY_LIMIT_EXCEEDED' }, fail: true },
    ])

    await expect(client.post('/user.get', {})).rejects.toMatchObject({
      response: { status: 503 },
    })

    // 1 original + 4 retentativas.
    expect(calls()).toBe(5)
  })

  it('429 OPERATION_TIME_LIMIT não é repetido — pausa e desiste', async () => {
    const limits = new InMemoryBitrixLimits()
    setBitrixLimits(limits)

    const { client, calls } = makeClient([
      {
        status: 429,
        data: {
          error: 'OPERATION_TIME_LIMIT',
          time: { operating_reset_at: Date.now() / 1000 + 120 },
        },
        fail: true,
      },
    ])

    await expect(client.post('/crm.item.list', {})).rejects.toBeInstanceOf(
      BitrixMethodPausedError,
    )
    expect(calls()).toBe(1)

    const pausedUntil = await limits.pausedUntil({
      domain: 'portal.bitrix24.com.br',
      method: 'crm.item.list',
    })
    expect(pausedUntil).toBeGreaterThan(Date.now())
  })

  it('método pausado falha antes de sair da nossa infra', async () => {
    const limits = new InMemoryBitrixLimits()
    await limits.pauseMethod(
      { domain: 'portal.bitrix24.com.br', method: 'crm.item.list' },
      Date.now() + 60_000,
    )
    setBitrixLimits(limits)

    const { client, calls } = makeClient([{ status: 200, data: {} }])

    await expect(client.post('/crm.item.list', {})).rejects.toBeInstanceOf(
      BitrixMethodPausedError,
    )
    // Não chegou no adapter: a chamada só renovaria o bloqueio.
    expect(calls()).toBe(0)
  })

  it('a pausa é por método: outro método do mesmo portal continua passando', async () => {
    const limits = new InMemoryBitrixLimits()
    await limits.pauseMethod(
      { domain: 'portal.bitrix24.com.br', method: 'crm.item.list' },
      Date.now() + 60_000,
    )
    setBitrixLimits(limits)

    const { client } = makeClient([{ status: 200, data: { result: 'ok' } }])

    await expect(client.post('/user.get', {})).resolves.toMatchObject({
      data: { result: 'ok' },
    })
  })

  it('operating perto do teto pausa o método pela resposta de sucesso', async () => {
    const limits = new InMemoryBitrixLimits()
    setBitrixLimits(limits)

    const { client } = makeClient([
      { status: 200, data: { result: [], time: { operating: 470 } } },
    ])

    await client.post('/crm.item.list', {})

    expect(
      await limits.pausedUntil({
        domain: 'portal.bitrix24.com.br',
        method: 'crm.item.list',
      }),
    ).toBeGreaterThan(Date.now())
  })

  it('erro de negócio do Bitrix sobe sem retentativa', async () => {
    const { client, calls } = makeClient([
      { status: 400, data: { error: 'CHAT_ID_EMPTY' }, fail: true },
    ])

    await expect(client.post('/imbot.message.add', {})).rejects.toMatchObject({
      response: { status: 400 },
    })
    expect(calls()).toBe(1)
  })

  it('o balde atrasa a chamada que passa do teto', async () => {
    const waits: number[] = []
    setBitrixLimits(
      new InMemoryBitrixLimits(DEFAULT_BUCKET_LIMITS, Date.now, ms => {
        waits.push(ms)
        return Promise.resolve()
      }),
    )

    const { client } = makeClient([{ status: 200, data: {} }])

    for (let call = 0; call <= DEFAULT_BUCKET_LIMITS.capacity; call += 1) {
      await client.post('/user.get', {})
    }

    expect(waits).toHaveLength(1)
  })
})
