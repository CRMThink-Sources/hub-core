import { describe, expect, it } from 'vitest'
import {
  endOfCalendarDay,
  formatCalendarDate,
  parseSpaCalendarDate,
  startOfCalendarDay,
  toSpaCalendarDateValue,
} from './spa-calendar-date'

describe('parseSpaCalendarDate', () => {
  /**
   * O caso que produzia o D-1: `new Date('2026-08-01T00:00:00+03:00')` é o instante
   * `2026-07-31T21:00:00Z`, e qualquer leitura do dia em UTC ou a oeste devolve 31.
   * O dia denotado pela string é 1º, e é o que tem que sair.
   */
  it('lê o dia do offset que a própria string carrega', () => {
    expect(parseSpaCalendarDate('2026-08-01T00:00:00+03:00')).toEqual({
      year: 2026,
      month: 8,
      day: 1,
    })
  })

  it('lê o dia de um valor em UTC', () => {
    expect(parseSpaCalendarDate('2026-08-01T00:00:00.000Z')).toEqual({
      year: 2026,
      month: 8,
      day: 1,
    })
  })

  it('a hora dentro do dia não muda o dia', () => {
    expect(parseSpaCalendarDate('2026-08-01T23:30:00+03:00')).toEqual({
      year: 2026,
      month: 8,
      day: 1,
    })
  })

  it('aceita data sem parte de hora', () => {
    expect(parseSpaCalendarDate('2026-08-01')).toEqual({
      year: 2026,
      month: 8,
      day: 1,
    })
  })

  it('lê o dia de um Date pelos componentes UTC', () => {
    expect(parseSpaCalendarDate(new Date('2026-08-01T12:00:00.000Z'))).toEqual({
      year: 2026,
      month: 8,
      day: 1,
    })
  })

  it.each([[null], [undefined], [''], ['   '], ['não é data'], [42]])(
    'devolve null para %s',
    value => {
      expect(parseSpaCalendarDate(value)).toBeNull()
    },
  )

  it('devolve null para Date inválido', () => {
    expect(parseSpaCalendarDate(new Date('nada'))).toBeNull()
  })

  /** Casa com o regex e não existe — a ida e volta por `Date.UTC` pega. */
  it('rejeita dia que não existe no mês', () => {
    expect(parseSpaCalendarDate('2026-02-31')).toBeNull()
  })

  it('aceita 29 de fevereiro em ano bissexto e rejeita fora dele', () => {
    expect(parseSpaCalendarDate('2028-02-29')).toEqual({
      year: 2028,
      month: 2,
      day: 29,
    })
    expect(parseSpaCalendarDate('2026-02-29')).toBeNull()
  })
})

describe('âncoras', () => {
  const dia = { year: 2026, month: 8, day: 1 }

  it('início do dia é meia-noite UTC', () => {
    expect(startOfCalendarDay(dia).toISOString()).toBe(
      '2026-08-01T00:00:00.000Z',
    )
  })

  /** O período vai até o dia 1º, e inclui o dia 1º inteiro. */
  it('fim do dia é o último milissegundo UTC', () => {
    expect(endOfCalendarDay(dia).toISOString()).toBe('2026-08-01T23:59:59.999Z')
  })

  it('atravessa a virada do mês sem transbordar', () => {
    expect(
      endOfCalendarDay({ year: 2026, month: 12, day: 31 }).toISOString(),
    ).toBe('2026-12-31T23:59:59.999Z')
  })
})

describe('toSpaCalendarDateValue', () => {
  /**
   * Meia-noite era o problema: qualquer offset negativo a lê no dia anterior.
   * Meio-dia é estável em todo offset que existe.
   */
  it('ancora no meio-dia UTC do dia', () => {
    expect(toSpaCalendarDateValue(new Date('2026-08-01T00:00:00.000Z'))).toBe(
      '2026-08-01T12:00:00.000Z',
    )
  })

  it('descarta a hora do Date e mantém o dia', () => {
    expect(toSpaCalendarDateValue(new Date('2026-08-01T23:59:59.999Z'))).toBe(
      '2026-08-01T12:00:00.000Z',
    )
  })

  it('mantém o formato ISO completo que a SPA já aceita', () => {
    expect(
      toSpaCalendarDateValue(new Date('2026-08-01T12:00:00.000Z')),
    ).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  /**
   * A propriedade que interessa: o dia lido de volta é o mesmo em qualquer offset
   * de portal plausível. É isto que torna a escrita independente de onde o portal
   * está.
   */
  it.each([-11, -3, 0, 3, 11])(
    'o dia sobrevive à leitura num portal em UTC%s',
    offsetHours => {
      const escrito = toSpaCalendarDateValue(
        new Date('2026-08-01T00:00:00.000Z'),
      )
      const noPortal = new Date(
        new Date(escrito).getTime() + offsetHours * 60 * 60 * 1000,
      )

      expect(formatCalendarDate(noPortal)).toBe('2026-08-01')
    },
  )

  /** Ida e volta: o que a escrita emite, a leitura devolve como o mesmo dia. */
  it('faz round-trip com a leitura', () => {
    const dia = { year: 2026, month: 8, day: 1 }
    const escrito = toSpaCalendarDateValue(endOfCalendarDay(dia))

    expect(parseSpaCalendarDate(escrito)).toEqual(dia)
  })
})
