import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SEND_FILTERS,
  readSendFilters,
  type SendFilters,
} from '../../_lib/send-filters'
import {
  clearedSendFilters,
  hasActiveFilters,
  isValidCustomRange,
  localDayDaysAgo,
  mergeSendFiltersIntoSearch,
  presentTimestamps,
  sendPagination,
  senderDisplay,
  toLocalDay,
  withFilterChange,
} from './envios-view'

const filters = (patch: Partial<SendFilters> = {}): SendFilters => ({
  ...DEFAULT_SEND_FILTERS,
  ...patch,
})

describe('mergeSendFiltersIntoSearch', () => {
  it('mantém os parâmetros do iframe do Bitrix e troca só os filtros', () => {
    const merged = mergeSendFiltersIntoSearch(
      'DOMAIN=acme.bitrix24.com.br&member_id=abc&status=FAILED&page=3',
      filters({ status: 'READ' }),
    )
    const params = new URLSearchParams(merged)
    expect(params.get('DOMAIN')).toBe('acme.bitrix24.com.br')
    expect(params.get('member_id')).toBe('abc')
    expect(params.get('status')).toBe('READ')
    expect(params.get('page')).toBeNull()
  })

  it('filtro padrão limpa todos os parâmetros dos filtros', () => {
    expect(
      mergeSendFiltersIntoSearch(
        'period=30&line=9&destination=99&senderId=4&from=x&to=y',
        DEFAULT_SEND_FILTERS,
      ),
    ).toBe('')
  })

  it('faz ida e volta com readSendFilters', () => {
    const original = filters({
      period: { kind: 'custom', from: '2026-11-01', to: '2026-11-20' },
      status: 'FAILED',
      lineId: '12',
      destination: '99091017',
      senderId: '7',
      page: 2,
    })
    const merged = mergeSendFiltersIntoSearch('DOMAIN=x.bitrix24.com', original)
    expect(readSendFilters(new URLSearchParams(merged))).toEqual(original)
  })
})

describe('withFilterChange', () => {
  it('volta para a página 1 ao mudar um filtro', () => {
    expect(
      withFilterChange(filters({ page: 5 }), { status: 'FAILED' }),
    ).toEqual(filters({ status: 'FAILED', page: 1 }))
  })
})

describe('hasActiveFilters', () => {
  it('padrão não conta como filtro, nem a página', () => {
    expect(hasActiveFilters(clearedSendFilters())).toBe(false)
    expect(hasActiveFilters(filters({ page: 3 }))).toBe(false)
  })

  it('qualquer filtro fora do padrão conta', () => {
    expect(hasActiveFilters(filters({ lineId: '1' }))).toBe(true)
    expect(
      hasActiveFilters(filters({ period: { kind: 'preset', days: 30 } })),
    ).toBe(true)
  })
})

describe('sendPagination', () => {
  it('calcula o total de páginas e os botões', () => {
    expect(sendPagination(41, 20, 1)).toEqual({
      totalPages: 3,
      hasPrevious: false,
      hasNext: true,
    })
    expect(sendPagination(41, 20, 3)).toEqual({
      totalPages: 3,
      hasPrevious: true,
      hasNext: false,
    })
  })

  it('lista vazia tem uma página', () => {
    expect(sendPagination(0, 20, 1)).toEqual({
      totalPages: 1,
      hasPrevious: false,
      hasNext: false,
    })
  })

  it('limit inválido não divide por zero', () => {
    expect(sendPagination(50, 0, 1).totalPages).toBe(1)
    expect(sendPagination(50, Number.NaN, 1).totalPages).toBe(1)
  })

  it('não passa do teto de página da API', () => {
    expect(sendPagination(10_000_000, 1, 1).totalPages).toBe(10000)
  })

  it('página além do total (link antigo) ainda pode voltar', () => {
    expect(sendPagination(10, 20, 4)).toEqual({
      totalPages: 1,
      hasPrevious: true,
      hasNext: false,
    })
  })
})

describe('senderDisplay', () => {
  it('usa o nome quando existe', () => {
    expect(senderDisplay({ id: '3', name: 'Ana' })).toEqual({
      kind: 'name',
      name: 'Ana',
    })
  })

  it('robô sem usuário vira automação', () => {
    expect(senderDisplay({ id: null, name: null })).toEqual({
      kind: 'automation',
    })
  })

  it('usuário sem nome resolvido fica neutro', () => {
    expect(senderDisplay({ id: '3', name: null })).toEqual({ kind: 'unknown' })
    expect(senderDisplay({ id: '3', name: '  ' })).toEqual({ kind: 'unknown' })
  })
})

describe('presentTimestamps', () => {
  it('mostra só os horários existentes, em ordem', () => {
    expect(
      presentTimestamps({
        sentAt: '2026-11-20T10:00:00.000Z',
        deliveredAt: null,
        readAt: '2026-11-20T10:05:00.000Z',
        rejectedAt: null,
      }),
    ).toEqual([
      { key: 'sentAt', at: '2026-11-20T10:00:00.000Z' },
      { key: 'readAt', at: '2026-11-20T10:05:00.000Z' },
    ])
  })
})

describe('dias locais', () => {
  it('formata o dia local com zeros', () => {
    expect(toLocalDay(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })

  it('7 dias incluem hoje', () => {
    expect(localDayDaysAgo(new Date(2026, 10, 27, 8), 7)).toBe('2026-11-21')
    expect(localDayDaysAgo(new Date(2026, 2, 2, 8), 7)).toBe('2026-02-24')
  })

  it('valida o intervalo personalizado', () => {
    expect(isValidCustomRange('2026-11-01', '2026-11-01')).toBe(true)
    expect(isValidCustomRange('2026-11-02', '2026-11-01')).toBe(false)
    expect(isValidCustomRange('', '2026-11-01')).toBe(false)
  })
})
