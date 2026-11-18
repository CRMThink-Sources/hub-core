import { describe, expect, it } from 'vitest'
import {
  channelSlaVsMeta,
  knownReasonKey,
  satisfactionPercent,
  sortReasons,
} from './insights-full'

describe('satisfactionPercent', () => {
  it('devolve null quando os dois são null', () => {
    expect(satisfactionPercent(null, null)).toBeNull()
  })
  it('devolve null quando ninguém avaliou (0 e 0)', () => {
    expect(satisfactionPercent(0, 0)).toBeNull()
  })
  it('trata um lado null como zero se o outro tem nota', () => {
    expect(satisfactionPercent(3, null)).toBe(100)
    expect(satisfactionPercent(null, 2)).toBe(0)
  })
  it('calcula likes sobre o total de notas', () => {
    expect(satisfactionPercent(3, 1)).toBe(75)
    expect(satisfactionPercent(0, 4)).toBe(0)
    expect(satisfactionPercent(1, 2)).toBeCloseTo(33.333, 2)
  })
})

describe('sortReasons', () => {
  it('devolve lista vazia para null e para objeto vazio', () => {
    expect(sortReasons(null)).toEqual([])
    expect(sortReasons({})).toEqual([])
  })
  it('ordena do maior para o menor e calcula a fatia', () => {
    expect(sortReasons({ a: 1, b: 3 })).toEqual([
      { key: 'b', count: 3, share: 75 },
      { key: 'a', count: 1, share: 25 },
    ])
  })
  it('desempata pela chave para a ordem ser estável', () => {
    expect(sortReasons({ z: 2, a: 2 }).map(r => r.key)).toEqual(['a', 'z'])
  })
  it('as fatias somam cerca de 100', () => {
    const total = sortReasons({ a: 1, b: 1, c: 1 }).reduce(
      (acc, r) => acc + r.share,
      0,
    )
    expect(total).toBeCloseTo(100, 5)
  })
  it('total zero dá fatia zero, sem NaN', () => {
    expect(sortReasons({ a: 0, b: 0 })).toEqual([
      { key: 'a', count: 0, share: 0 },
      { key: 'b', count: 0, share: 0 },
    ])
  })
  it('ignora contagem inválida', () => {
    expect(sortReasons({ a: Number.NaN, b: -2, c: 2 })).toEqual([
      { key: 'c', count: 2, share: 100 },
    ])
  })
})

describe('knownReasonKey', () => {
  it('reconhece as chaves que o painel traduz', () => {
    expect(knownReasonKey('auto')).toBe('auto')
    expect(knownReasonKey('outro')).toBe('outro')
  })
  it('devolve null para chave desconhecida ou nomes de protótipo', () => {
    expect(knownReasonKey('qualquer-coisa')).toBeNull()
    expect(knownReasonKey('constructor')).toBeNull()
    expect(knownReasonKey('__proto__')).toBeNull()
  })
})

describe('channelSlaVsMeta', () => {
  it('devolve lista vazia para null', () => {
    expect(channelSlaVsMeta(null, 15)).toEqual([])
  })
  it('compara o objetivo do canal com a referência do painel', () => {
    expect(
      channelSlaVsMeta(
        [
          { name: 'A', seconds: 300 },
          { name: 'B', seconds: 900 },
          { name: 'C', seconds: 1800 },
        ],
        15,
      ),
    ).toEqual([
      { name: 'A', seconds: 300, versus: 'stricter' },
      { name: 'B', seconds: 900, versus: 'same' },
      { name: 'C', seconds: 1800, versus: 'looser' },
    ])
  })
})
