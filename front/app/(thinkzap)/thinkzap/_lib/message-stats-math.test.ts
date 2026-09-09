import { describe, expect, it } from 'vitest'
import { percentChange, sumCounts } from './message-stats-math'

describe('sumCounts', () => {
  it('soma sent e received dos dois providers', () => {
    expect(
      sumCounts({ sent: 10, received: 5 }, { sent: 3, received: 8 }),
    ).toEqual({ sent: 13, received: 13 })
  })
})

describe('percentChange', () => {
  it('calcula alta', () => {
    expect(percentChange(150, 100)).toEqual({ kind: 'up', percent: 50 })
  })

  it('calcula queda', () => {
    expect(percentChange(50, 100)).toEqual({ kind: 'down', percent: 50 })
  })

  it('sem variação é flat', () => {
    expect(percentChange(100, 100)).toEqual({ kind: 'flat' })
  })

  it('os dois zerados é flat, não novo', () => {
    expect(percentChange(0, 0)).toEqual({ kind: 'flat' })
  })

  it('período anterior zerado com volume agora é novo, não divisão por zero', () => {
    expect(percentChange(20, 0)).toEqual({ kind: 'new' })
  })
})
