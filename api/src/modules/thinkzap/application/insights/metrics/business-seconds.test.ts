import { describe, expect, it } from 'vitest'
import { businessSeconds } from './business-seconds'

const cfg = { bhDays: [1, 2, 3, 4, 5], bhStart: 8, bhEnd: 18 }

describe('businessSeconds', () => {
  it('ignora fim de semana', () => {
    // sábado 10/01/2026 e domingo 11/01/2026 (Brasília)
    expect(
      businessSeconds('2026-01-10T12:00:00Z', '2026-01-11T20:00:00Z', cfg),
    ).toBe(0)
  })

  it('limita ao horário comercial', () => {
    // segunda 05/01/2026, 07:00 a 20:00 em Brasília = 10:00Z a 23:00Z
    expect(
      businessSeconds('2026-01-05T10:00:00Z', '2026-01-05T23:00:00Z', cfg),
    ).toBe(10 * 3600)
  })

  it('soma vários dias úteis pulando o fim de semana', () => {
    // sexta 09/01 17:00 BRT a segunda 12/01 09:00 BRT = 1h + 1h
    expect(
      businessSeconds('2026-01-09T20:00:00Z', '2026-01-12T12:00:00Z', cfg),
    ).toBe(2 * 3600)
  })

  it('retorna 0 quando fim <= início', () => {
    expect(
      businessSeconds('2026-01-05T15:00:00Z', '2026-01-05T15:00:00Z', cfg),
    ).toBe(0)
    expect(
      businessSeconds(
        new Date('2026-01-05T16:00:00Z'),
        new Date('2026-01-05T15:00:00Z'),
        cfg,
      ),
    ).toBe(0)
  })
})
