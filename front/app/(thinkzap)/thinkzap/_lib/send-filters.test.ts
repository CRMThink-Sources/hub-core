import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SEND_FILTERS,
  readSendFilters,
  toApiQuery,
  writeSendFilters,
  type SendFilters,
} from './send-filters'

const read = (qs: string) => readSendFilters(new URLSearchParams(qs))

describe('readSendFilters', () => {
  it('URL vazia dá o padrão (7 dias, página 1)', () => {
    expect(read('')).toEqual(DEFAULT_SEND_FILTERS)
    expect(DEFAULT_SEND_FILTERS.period).toEqual({ kind: 'preset', days: 7 })
    expect(DEFAULT_SEND_FILTERS.page).toBe(1)
  })

  it.each([
    'period=15',
    'period=abc',
    'period=custom',
    'period=custom&from=2026-02-31&to=2026-03-01',
    'period=custom&from=2026-03-10&to=2026-03-01',
    'period=custom&from=ontem&to=hoje',
    'status=NOPE',
    'status=read',
    'page=0',
    'page=-2',
    'page=1.5',
    'page=1e3',
    'page=10001',
    'page=abc',
  ])('valor inválido (%s) volta ao padrão', qs => {
    expect(read(qs)).toEqual(DEFAULT_SEND_FILTERS)
  })

  it('texto vazio ou longo demais é ignorado', () => {
    expect(read('line=%20&destination=' + '9'.repeat(192))).toEqual(
      DEFAULT_SEND_FILTERS,
    )
  })
})

describe('ida e volta pela query string', () => {
  const cases: SendFilters[] = [
    DEFAULT_SEND_FILTERS,
    { ...DEFAULT_SEND_FILTERS, period: { kind: 'preset', days: 90 } },
    {
      period: { kind: 'custom', from: '2026-03-01', to: '2026-03-15' },
      status: 'PARTIAL',
      lineId: '12',
      destination: '5511999990000',
      senderId: '7',
      page: 3,
    },
  ]

  it.each(cases)('preserva %j', filters => {
    expect(read(writeSendFilters(filters))).toEqual(filters)
  })

  it('o padrão gera URL vazia e página 1 não é escrita', () => {
    expect(writeSendFilters(DEFAULT_SEND_FILTERS)).toBe('')
    expect(writeSendFilters({ ...DEFAULT_SEND_FILTERS, status: 'READ' })).toBe(
      'status=READ',
    )
  })
})

describe('toApiQuery', () => {
  // Esperados montados com os mesmos construtores locais: vale em qualquer TZ.
  const now = new Date(2026, 10, 27, 15, 30, 0, 0)

  it('preset de 7 dias: início do dia local 6 dias atrás até o fim do dia local', () => {
    const q = toApiQuery(DEFAULT_SEND_FILTERS, now)
    expect(q.from).toBe(new Date(2026, 10, 21, 0, 0, 0, 0).toISOString())
    expect(q.to).toBe(new Date(2026, 10, 27, 23, 59, 59, 999).toISOString())
  })

  it('período personalizado usa o dia local inteiro, com instante completo', () => {
    const q = toApiQuery(
      {
        ...DEFAULT_SEND_FILTERS,
        period: { kind: 'custom', from: '2026-03-01', to: '2026-03-15' },
      },
      now,
    )
    expect(q.from).toBe(new Date(2026, 2, 1, 0, 0, 0, 0).toISOString())
    expect(q.to).toBe(new Date(2026, 2, 15, 23, 59, 59, 999).toISOString())
    expect(q.from).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('omite filtros vazios e página 1', () => {
    const q = toApiQuery(DEFAULT_SEND_FILTERS, now)
    expect(Object.keys(q).sort()).toEqual(['from', 'to'])
  })

  it('inclui os filtros preenchidos', () => {
    const q = toApiQuery(
      {
        ...DEFAULT_SEND_FILTERS,
        status: 'FAILED',
        lineId: '12',
        destination: '5511',
        senderId: '7',
        page: 2,
      },
      now,
    )
    expect(q).toMatchObject({
      status: 'FAILED',
      line: '12',
      destination: '5511',
      senderId: '7',
      page: 2,
    })
  })
})
