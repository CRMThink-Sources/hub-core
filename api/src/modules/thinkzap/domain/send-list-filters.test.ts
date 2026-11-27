import { describe, expect, it } from 'vitest'
import { InvalidSendListFilterError } from '@/modules/thinkzap/domain/errors/invalid-send-list-filter.error'
import {
  normalizeSendListFilters,
  SEND_LIST_MAX_LIMIT,
  SEND_LIST_STATUSES,
  sendHistoryFloor,
} from '@/modules/thinkzap/domain/send-list-filters'

const now = new Date('2026-11-27T12:00:00.000Z')
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

describe('normalizeSendListFilters', () => {
  it('usa os últimos 7 dias, página 1 e limite 20 quando nada vem', () => {
    expect(normalizeSendListFilters({}, now)).toEqual({
      from: daysAgo(7),
      to: now,
      status: null,
      subscriptionItemId: null,
      destination: null,
      senderId: null,
      page: 1,
      limit: 20,
    })
  })

  it('limita um período de 120 dias a 90, sem recusar', () => {
    const filters = normalizeSendListFilters(
      { from: daysAgo(120), to: now },
      now,
    )

    expect(filters.from).toEqual(daysAgo(90))
    expect(filters.from).toEqual(sendHistoryFloor(now))
    expect(filters.to).toEqual(now)
  })

  it('mantém um período dentro dos 90 dias como veio', () => {
    const filters = normalizeSendListFilters(
      { from: daysAgo(30).toISOString(), to: daysAgo(10).toISOString() },
      now,
    )

    expect(filters.from).toEqual(daysAgo(30))
    expect(filters.to).toEqual(daysAgo(10))
  })

  it('troca as datas quando o início vem depois do fim', () => {
    const filters = normalizeSendListFilters(
      { from: daysAgo(2), to: daysAgo(5) },
      now,
    )

    expect(filters.from).toEqual(daysAgo(5))
    expect(filters.to).toEqual(daysAgo(2))
  })

  it('não deixa o fim passar de agora', () => {
    const filters = normalizeSendListFilters(
      { to: new Date('2027-01-01T00:00:00.000Z') },
      now,
    )

    expect(filters.to).toEqual(now)
    expect(filters.from).toEqual(daysAgo(7))
  })

  it('período inteiro além de 90 dias vira janela vazia, nunca envio antigo', () => {
    const filters = normalizeSendListFilters(
      { from: daysAgo(200), to: daysAgo(150) },
      now,
    )

    expect(filters.from).toEqual(daysAgo(90))
    expect(filters.to < filters.from).toBe(true)
  })

  it('recusa data inválida', () => {
    expect(() => normalizeSendListFilters({ from: 'ontem' }, now)).toThrow(
      InvalidSendListFilterError,
    )
  })

  it('reduz o destinatário com máscara e código do país a dígitos', () => {
    expect(
      normalizeSendListFilters({ destination: '+55 (11) 99091-017' }, now)
        .destination,
    ).toBe('551199091017')
    expect(
      normalizeSendListFilters({ destination: '9909-1017' }, now).destination,
    ).toBe('99091017')
  })

  it('destinatário sem dígito vira filtro ausente', () => {
    expect(
      normalizeSendListFilters({ destination: ' (-) ' }, now).destination,
    ).toBeNull()
    expect(
      normalizeSendListFilters({ destination: '' }, now).destination,
    ).toBeNull()
  })

  it.each(SEND_LIST_STATUSES)('aceita o status %s', status => {
    expect(normalizeSendListFilters({ status }, now).status).toBe(status)
  })

  it('aceita o status em minúsculas', () => {
    expect(normalizeSendListFilters({ status: 'failed' }, now).status).toBe(
      'FAILED',
    )
  })

  it('recusa status desconhecido com erro tipado', () => {
    let error: unknown
    try {
      normalizeSendListFilters({ status: 'ENTREGUE' }, now)
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(InvalidSendListFilterError)
    expect(error).toMatchObject({ field: 'status', value: 'ENTREGUE' })
  })

  it('status vazio é filtro ausente', () => {
    expect(normalizeSendListFilters({ status: '  ' }, now).status).toBeNull()
  })

  it('limita o limit ao teto e ao mínimo de 1', () => {
    expect(normalizeSendListFilters({ limit: 500 }, now).limit).toBe(
      SEND_LIST_MAX_LIMIT,
    )
    expect(normalizeSendListFilters({ limit: 0 }, now).limit).toBe(1)
    expect(normalizeSendListFilters({ limit: 35 }, now).limit).toBe(35)
  })

  it('página abaixo de 1 vira 1', () => {
    expect(normalizeSendListFilters({ page: 0 }, now).page).toBe(1)
    expect(normalizeSendListFilters({ page: -3 }, now).page).toBe(1)
    expect(normalizeSendListFilters({ page: 4 }, now).page).toBe(4)
  })

  it('apara linha e remetente, e vazio vira ausente', () => {
    const filters = normalizeSendListFilters(
      { line: ' item-1 ', senderId: '' },
      now,
    )

    expect(filters.subscriptionItemId).toBe('item-1')
    expect(filters.senderId).toBeNull()
  })
})
