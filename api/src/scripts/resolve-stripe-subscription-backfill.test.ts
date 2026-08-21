import { describe, expect, it } from 'vitest'

import {
  mapStripeStatus,
  readClientId,
  toStripeSubscriptionRow,
  triageSubscriptions,
  type StripeSubscriptionLike,
} from './resolve-stripe-subscription-backfill'

function makeSubscription(
  overrides: Partial<StripeSubscriptionLike> = {},
): StripeSubscriptionLike {
  return {
    id: 'sub_1',
    status: 'active',
    metadata: { clientId: '4321' },
    created: 1_700_000_000,
    items: { data: [{ quantity: 1 }] },
    ...overrides,
  }
}

describe('mapStripeStatus', () => {
  it('mapeia os dois status de cobrança viva', () => {
    expect(mapStripeStatus('active')).toBe('active')
    expect(mapStripeStatus('trialing')).toBe('trialing')
  })

  /** Inadimplente espelhado como ativo daria acesso a quem não pagou. */
  it('não mapeia status que não descrevem cobrança viva', () => {
    for (const status of [
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid',
      'paused',
    ]) {
      expect(mapStripeStatus(status)).toBeNull()
    }
  })

  it('não normaliza texto — status desconhecido é null', () => {
    expect(mapStripeStatus('ACTIVE')).toBeNull()
    expect(mapStripeStatus('')).toBeNull()
  })
})

describe('readClientId', () => {
  it('lê o clientId do metadata', () => {
    expect(readClientId(makeSubscription())).toBe('4321')
  })

  it('trata ausente, vazio e só espaço como ausente', () => {
    expect(readClientId(makeSubscription({ metadata: {} }))).toBeNull()
    expect(readClientId(makeSubscription({ metadata: null }))).toBeNull()
    expect(
      readClientId(makeSubscription({ metadata: { clientId: '   ' } })),
    ).toBeNull()
  })

  it('remove espaço em volta', () => {
    expect(
      readClientId(makeSubscription({ metadata: { clientId: ' 99 ' } })),
    ).toBe('99')
  })
})

describe('toStripeSubscriptionRow', () => {
  it('normaliza a assinatura do gateway', () => {
    const row = toStripeSubscriptionRow(
      makeSubscription({
        id: 'sub_9',
        status: 'trialing',
        trial_end: 1_700_086_400,
        items: { data: [{ quantity: 3 }] },
      }),
    )

    expect(row).toEqual({
      id: 'sub_9',
      status: 'trialing',
      clientId: '4321',
      quantity: 3,
      trialEnd: new Date(1_700_086_400 * 1000),
      createdAt: new Date(1_700_000_000 * 1000),
    })
  })

  /** A quantidade vive no item de linha, não na assinatura. */
  it('quantidade ausente vira 0', () => {
    expect(
      toStripeSubscriptionRow(makeSubscription({ items: { data: [] } }))
        .quantity,
    ).toBe(0)
    expect(
      toStripeSubscriptionRow(makeSubscription({ items: undefined })).quantity,
    ).toBe(0)
  })

  it('trial_end ausente vira null', () => {
    expect(toStripeSubscriptionRow(makeSubscription()).trialEnd).toBeNull()
  })
})

describe('triageSubscriptions', () => {
  it('separa elegíveis, status fora do mapa e sem clientId', () => {
    const rows = [
      toStripeSubscriptionRow(makeSubscription({ id: 'sub_ok' })),
      toStripeSubscriptionRow(
        makeSubscription({ id: 'sub_cancelada', status: 'canceled' }),
      ),
      toStripeSubscriptionRow(
        makeSubscription({ id: 'sub_orfa', metadata: {} }),
      ),
    ]

    const triage = triageSubscriptions(rows)

    expect(triage.eligible.map(entry => entry.row.id)).toEqual(['sub_ok'])
    expect(triage.eligible[0]!.status).toBe('active')
    expect(
      triage.problems.map(problem => [problem.kind, problem.row.id]),
    ).toEqual([
      ['status', 'sub_cancelada'],
      ['without-client-id', 'sub_orfa'],
    ])
  })

  /** Status é avaliado antes do clientId: cancelada sem clientId não vira órfã. */
  it('cancelada sem clientId é contada por status, não como órfã', () => {
    const triage = triageSubscriptions([
      toStripeSubscriptionRow(
        makeSubscription({ status: 'canceled', metadata: {} }),
      ),
    ])

    expect(
      triage.problems.map(problem => [problem.kind, problem.row.status]),
    ).toEqual([['status', 'canceled']])
  })

  it('ordena por data de criação, mais antiga primeiro', () => {
    const triage = triageSubscriptions([
      toStripeSubscriptionRow(
        makeSubscription({ id: 'nova', created: 1_800_000_000 }),
      ),
      toStripeSubscriptionRow(
        makeSubscription({ id: 'antiga', created: 1_600_000_000 }),
      ),
    ])

    expect(triage.eligible.map(entry => entry.row.id)).toEqual([
      'antiga',
      'nova',
    ])
  })
})
