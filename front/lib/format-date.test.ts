import { describe, expect, it } from 'vitest'
import { formatRelativeInstant, formatSpaDate } from './format-date'

/**
 * O bug de D-1: a api entrega o dia ancorado em UTC, e formatar sem nomear o fuso
 * deixava o navegador reinterpretar. `pt-BR` fixo nos testes porque o que está sob
 * teste é o **dia**, não a ordem dos campos — locale é de quem olha, fuso é do
 * contrato.
 */
describe('formatSpaDate', () => {
  it('formata o dia da âncora de início', () => {
    expect(formatSpaDate('2026-08-01T00:00:00.000Z', 'pt-BR')).toBe(
      '01/08/2026',
    )
  })

  /**
   * A âncora de fim é `23:59:59.999Z` — o caso em que a falta de `timeZone` mais
   * dói: em qualquer fuso a leste de UTC ela cai no dia seguinte.
   */
  it('formata o dia da âncora de fim, sem escorregar para o dia seguinte', () => {
    expect(formatSpaDate('2026-08-01T23:59:59.999Z', 'pt-BR')).toBe(
      '01/08/2026',
    )
  })

  it('não escorrega para o dia anterior na âncora de início', () => {
    expect(formatSpaDate('2026-08-01T00:00:00.000Z', 'pt-BR')).not.toBe(
      '31/07/2026',
    )
  })

  it('atravessa a virada de ano', () => {
    expect(formatSpaDate('2026-12-31T23:59:59.999Z', 'pt-BR')).toBe(
      '31/12/2026',
    )
    expect(formatSpaDate('2027-01-01T00:00:00.000Z', 'pt-BR')).toBe(
      '01/01/2027',
    )
  })

  /** O locale muda a ordem dos campos; o dia é o mesmo. */
  it('respeita o locale sem mudar o dia', () => {
    expect(formatSpaDate('2026-08-01T23:59:59.999Z', 'en-US')).toBe(
      '08/01/2026',
    )
  })

  it('devolve o valor cru quando a data é inválida', () => {
    expect(formatSpaDate('não é data', 'pt-BR')).toBe('não é data')
    expect(formatSpaDate('', 'pt-BR')).toBe('')
  })

  /**
   * A propriedade que fecha o bug: o dia formatado não depende do fuso de quem olha.
   * `Intl` resolve o fuso pela opção `timeZone`, então o resultado é o mesmo em
   * qualquer navegador — é isso que este teste fixa contra regressão.
   */
  it('o dia é o mesmo para as duas âncoras do mesmo dia', () => {
    expect(formatSpaDate('2026-08-01T00:00:00.000Z', 'pt-BR')).toBe(
      formatSpaDate('2026-08-01T23:59:59.999Z', 'pt-BR'),
    )
  })
})

describe('formatRelativeInstant', () => {
  const now = new Date('2026-10-28T12:00:00Z')

  it('minutos e horas no passado', () => {
    expect(formatRelativeInstant('2026-10-28T11:48:00Z', now, 'pt-BR')).toBe(
      'há 12 minutos',
    )
    expect(formatRelativeInstant('2026-10-28T09:00:00Z', now, 'pt-BR')).toBe(
      'há 3 horas',
    )
  })

  it('menos de um minuto é agora', () => {
    expect(formatRelativeInstant('2026-10-28T11:59:40Z', now, 'pt-BR')).toBe(
      'agora',
    )
  })

  it('dias', () => {
    expect(formatRelativeInstant('2026-10-26T12:00:00Z', now, 'pt-BR')).toBe(
      'anteontem',
    )
  })

  it('data inválida volta crua', () => {
    expect(formatRelativeInstant('x', now, 'pt-BR')).toBe('x')
  })
})
