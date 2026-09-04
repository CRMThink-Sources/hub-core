import { describe, expect, it } from 'vitest'
import {
  OPERATING_LIMIT_SECONDS,
  pauseUntilMs,
  readOperating,
} from './operating-budget'

const NOW = 1_700_000_000_000

describe('readOperating', () => {
  it('lê o acumulado e converte o reset para ms', () => {
    const reading = readOperating({
      operating: 120,
      operating_reset_at: NOW / 1000 + 300,
    })

    expect(reading?.operating).toBe(120)
    expect(reading?.resetAtMs).toBe(NOW + 300_000)
    expect(reading?.ratio).toBeCloseTo(120 / OPERATING_LIMIT_SECONDS)
    expect(reading?.exhausted).toBe(false)
  })

  it('marca esgotado a partir de 85% do teto', () => {
    expect(readOperating({ operating: 407 })?.exhausted).toBe(false)
    expect(readOperating({ operating: 408 })?.exhausted).toBe(true)
  })

  it('resposta sem bloco time não é leitura', () => {
    expect(readOperating(undefined)).toBeNull()
    expect(readOperating({})).toBeNull()
  })

  it('operating não numérico não é leitura', () => {
    expect(readOperating({ operating: Number.NaN })).toBeNull()
  })

  it('reset ausente deixa resetAtMs nulo, sem invalidar a leitura', () => {
    const reading = readOperating({ operating: 10 })

    expect(reading?.resetAtMs).toBeNull()
    expect(reading?.operating).toBe(10)
  })
})

describe('pauseUntilMs', () => {
  it('usa o reset informado pelo Bitrix', () => {
    expect(pauseUntilMs({ resetAtMs: NOW + 120_000 }, NOW)).toBe(NOW + 120_000)
  })

  it('sem reset, pausa uma cesta de minuto', () => {
    expect(pauseUntilMs({ resetAtMs: null }, NOW)).toBe(NOW + 60_000)
  })

  it('reset no passado não libera a pausa imediatamente', () => {
    expect(pauseUntilMs({ resetAtMs: NOW - 5000 }, NOW)).toBe(NOW + 60_000)
  })

  it('sem leitura nenhuma, mesmo fallback', () => {
    expect(pauseUntilMs(null, NOW)).toBe(NOW + 60_000)
  })
})
