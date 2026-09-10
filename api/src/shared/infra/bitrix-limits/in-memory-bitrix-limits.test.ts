import { describe, expect, it } from 'vitest'
import { InMemoryBitrixLimits } from './in-memory-bitrix-limits'
import { DEFAULT_BUCKET_LIMITS } from './leaky-bucket'

const NOW = 1_700_000_000_000

/** Relógio e espera controlados: o teste observa a decisão sem esperar de verdade. */
function makeLimits() {
  let clock = NOW
  const waits: number[] = []

  const limits = new InMemoryBitrixLimits(
    DEFAULT_BUCKET_LIMITS,
    () => clock,
    ms => {
      waits.push(ms)
      clock += ms
      return Promise.resolve()
    },
  )

  return {
    limits,
    waits,
    advance: (ms: number) => {
      clock += ms
    },
  }
}

describe('InMemoryBitrixLimits', () => {
  it('não atrasa enquanto o balde tem espaço', async () => {
    const { limits, waits } = makeLimits()

    for (let call = 0; call < DEFAULT_BUCKET_LIMITS.capacity; call += 1) {
      await limits.acquire({ domain: 'a.bitrix24.com', method: 'user.get' })
    }

    expect(waits).toEqual([])
  })

  it('atrasa a chamada que passaria do teto', async () => {
    const { limits, waits } = makeLimits()

    for (let call = 0; call <= DEFAULT_BUCKET_LIMITS.capacity; call += 1) {
      await limits.acquire({ domain: 'a.bitrix24.com', method: 'user.get' })
    }

    expect(waits).toEqual([500])
  })

  it('o balde é por portal: um cliente não gasta o do outro', async () => {
    const { limits, waits } = makeLimits()

    for (let call = 0; call < DEFAULT_BUCKET_LIMITS.capacity; call += 1) {
      await limits.acquire({ domain: 'a.bitrix24.com', method: 'user.get' })
    }
    await limits.acquire({ domain: 'b.bitrix24.com', method: 'user.get' })

    expect(waits).toEqual([])
  })

  it('o balde é por portal, não por método: métodos diferentes disputam o mesmo', async () => {
    const { limits, waits } = makeLimits()

    for (let call = 0; call < DEFAULT_BUCKET_LIMITS.capacity; call += 1) {
      await limits.acquire({ domain: 'a.bitrix24.com', method: 'user.get' })
    }
    await limits.acquire({ domain: 'a.bitrix24.com', method: 'crm.item.list' })

    expect(waits).toEqual([500])
  })

  it('pausa de método vale só para aquele método', async () => {
    const { limits } = makeLimits()
    const context = { domain: 'a.bitrix24.com', method: 'crm.item.list' }

    await limits.pauseMethod(context, NOW + 60_000)

    expect(await limits.pausedUntil(context)).toBe(NOW + 60_000)
    expect(
      await limits.pausedUntil({ ...context, method: 'user.get' }),
    ).toBeNull()
  })

  it('pausa vencida libera o método', async () => {
    const { limits, advance } = makeLimits()
    const context = { domain: 'a.bitrix24.com', method: 'crm.item.list' }

    await limits.pauseMethod(context, NOW + 1000)
    advance(2000)

    expect(await limits.pausedUntil(context)).toBeNull()
  })

  it('operating longe do teto não pausa nada', async () => {
    const { limits } = makeLimits()
    const context = { domain: 'a.bitrix24.com', method: 'crm.item.list' }

    await limits.observeOperating(context, 100, null)

    expect(await limits.pausedUntil(context)).toBeNull()
  })

  it('operating perto do teto pausa antes do 429 chegar', async () => {
    const { limits } = makeLimits()
    const context = { domain: 'a.bitrix24.com', method: 'crm.item.list' }

    await limits.observeOperating(context, 420, NOW + 120_000)

    expect(await limits.pausedUntil(context)).toBe(NOW + 120_000)
  })
})
