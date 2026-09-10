import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BUCKET_LIMITS,
  ENTERPRISE_BUCKET_LIMITS,
  drain,
  emptyBucket,
  reserve,
} from './leaky-bucket'

const NOW = 1_700_000_000_000

describe('drain', () => {
  it('vaza o contador na taxa do plano', () => {
    const state = { level: 10, updatedAtMs: NOW }

    expect(drain(state, NOW + 2000, DEFAULT_BUCKET_LIMITS)).toBe(6)
  })

  it('não vaza abaixo de zero', () => {
    const state = { level: 3, updatedAtMs: NOW }

    expect(drain(state, NOW + 60_000, DEFAULT_BUCKET_LIMITS)).toBe(0)
  })

  it('relógio andando para trás não infla o contador', () => {
    const state = { level: 5, updatedAtMs: NOW }

    expect(drain(state, NOW - 5000, DEFAULT_BUCKET_LIMITS)).toBe(5)
  })
})

describe('reserve', () => {
  it('balde vazio libera na hora', () => {
    const decision = reserve(emptyBucket(NOW), NOW)

    expect(decision.waitMs).toBe(0)
    expect(decision.state.level).toBe(1)
  })

  it('rajada até o teto passa sem espera', () => {
    let state = emptyBucket(NOW)

    for (let call = 0; call < DEFAULT_BUCKET_LIMITS.capacity; call += 1) {
      const decision = reserve(state, NOW)
      expect(decision.waitMs).toBe(0)
      state = decision.state
    }

    expect(state.level).toBe(DEFAULT_BUCKET_LIMITS.capacity)
  })

  it('a chamada acima do teto espera o excedente vazar', () => {
    const full = {
      level: DEFAULT_BUCKET_LIMITS.capacity,
      updatedAtMs: NOW,
    }

    const decision = reserve(full, NOW)

    // 1 de excedente com vazão de 2/s = 500ms.
    expect(decision.waitMs).toBe(500)
  })

  it('sustentado na taxa de vazão nunca espera', () => {
    let state = emptyBucket(NOW)
    let clock = NOW

    for (let call = 0; call < 200; call += 1) {
      clock += 500 // 2 chamadas por segundo
      const decision = reserve(state, clock)
      expect(decision.waitMs).toBe(0)
      state = decision.state
    }
  })

  it('conta a chamada mesmo quando manda esperar', () => {
    const full = { level: DEFAULT_BUCKET_LIMITS.capacity, updatedAtMs: NOW }
    const decision = reserve(full, NOW)

    // Estado avança para depois da espera: duas reservas concorrentes não podem
    // reservar o mesmo espaço.
    expect(decision.state.updatedAtMs).toBe(NOW + decision.waitMs)
    expect(decision.state.level).toBe(DEFAULT_BUCKET_LIMITS.capacity)
  })

  it('Enterprise tem balde maior e vazão maior', () => {
    const full = { level: 250, updatedAtMs: NOW }

    expect(reserve(full, NOW, ENTERPRISE_BUCKET_LIMITS).waitMs).toBe(200)
  })

  it('custo maior que 1 espera proporcional', () => {
    const almostFull = {
      level: DEFAULT_BUCKET_LIMITS.capacity - 1,
      updatedAtMs: NOW,
    }

    expect(reserve(almostFull, NOW, DEFAULT_BUCKET_LIMITS, 5).waitMs).toBe(2000)
  })
})
