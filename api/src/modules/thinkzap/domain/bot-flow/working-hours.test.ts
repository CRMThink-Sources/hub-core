import { describe, expect, it } from 'vitest'
import { isWithinWorkingHours } from './working-hours'

/** Seg 2026-09-21, 14:00 em São Paulo. */
const segundaTarde = new Date('2026-09-21T17:00:00Z')
/** Dom 2026-09-20, 14:00 em São Paulo. */
const domingoTarde = new Date('2026-09-20T17:00:00Z')

const base = {
  WORKTIME_ENABLE: 'Y',
  WORKTIME_FROM: '9',
  WORKTIME_TO: '18',
  WORKTIME_TIMEZONE: 'America/Sao_Paulo',
  WORKTIME_DAYOFF: ['6', '0'],
  WORKTIME_HOLIDAYS: [''],
}

describe('isWithinWorkingHours', () => {
  it('dentro da janela em dia útil', () => {
    expect(isWithinWorkingHours(base, segundaTarde)).toBe(true)
  })

  it('fora da janela', () => {
    const noite = new Date('2026-09-21T23:00:00Z')
    expect(isWithinWorkingHours(base, noite)).toBe(false)
  })

  it('dia de folga fecha mesmo dentro da janela', () => {
    expect(isWithinWorkingHours(base, domingoTarde)).toBe(false)
  })

  it('feriado fecha mesmo em dia útil', () => {
    const feriado = { ...base, WORKTIME_HOLIDAYS: ['21.09'] }
    expect(isWithinWorkingHours(feriado, segundaTarde)).toBe(false)
  })

  it('minuto é minuto, não fração: 18.3 é 18:30', () => {
    const config = { ...base, WORKTIME_FROM: '18', WORKTIME_TO: '18.3' }
    const dezoitoEQuinze = new Date('2026-09-21T21:15:00Z')
    const dezoitoEQuarenta = new Date('2026-09-21T21:40:00Z')

    expect(isWithinWorkingHours(config, dezoitoEQuinze)).toBe(true)
    expect(isWithinWorkingHours(config, dezoitoEQuarenta)).toBe(false)
  })

  it('janela que vira o dia', () => {
    const config = { ...base, WORKTIME_FROM: '22', WORKTIME_TO: '6' }
    const duasDaManha = new Date('2026-09-21T05:00:00Z')

    expect(isWithinWorkingHours(config, duasDaManha)).toBe(true)
    expect(isWithinWorkingHours(config, segundaTarde)).toBe(false)
  })

  it('respeita o fuso do canal, não o do processo', () => {
    const tokyo = { ...base, WORKTIME_TIMEZONE: 'Asia/Tokyo' }
    // 17:00Z é 14:00 em SP (dentro) e 02:00 do dia seguinte em Tóquio (fora).
    expect(isWithinWorkingHours(base, segundaTarde)).toBe(true)
    expect(isWithinWorkingHours(tokyo, segundaTarde)).toBe(false)
  })

  // Fechar por engano cala o bot no meio do expediente; abrir por engano só o mantém no ar.
  it('na dúvida, aberto', () => {
    expect(isWithinWorkingHours(null)).toBe(true)
    expect(isWithinWorkingHours({}, segundaTarde)).toBe(true)
    expect(
      isWithinWorkingHours({ ...base, WORKTIME_ENABLE: 'N' }, domingoTarde),
    ).toBe(true)
    expect(
      isWithinWorkingHours(
        { ...base, WORKTIME_TIMEZONE: 'Nao/Existe' },
        segundaTarde,
      ),
    ).toBe(true)
    expect(
      isWithinWorkingHours({ ...base, WORKTIME_FROM: 'abc' }, segundaTarde),
    ).toBe(true)
  })

  it('domingo tanto em 0 quanto em 7', () => {
    expect(
      isWithinWorkingHours({ ...base, WORKTIME_DAYOFF: ['7'] }, domingoTarde),
    ).toBe(false)
  })
})
