import { describe, expect, it } from 'vitest'

import {
  resolveExpiredSubscriptionStatus,
  resolvePastDueAction,
} from './subscription-expiration'

/** Fim do período como o mapper ancora: último instante do dia, em UTC. */
const endOf = (day: string) => new Date(`${day}T23:59:59.999Z`)
const at = (iso: string) => new Date(iso)

describe('resolveExpiredSubscriptionStatus', () => {
  describe('trial', () => {
    const trial = {
      status: 'trialing' as const,
      modality: 'manual' as const,
      currentPeriodEnd: endOf('2026-10-12'),
    }

    it('continua em teste no último dia', () => {
      expect(
        resolveExpiredSubscriptionStatus(
          trial,
          at('2026-10-12T23:59:59.999Z'),
          0,
        ),
      ).toBeNull()
    })

    it('vira trial_expired depois do último dia', () => {
      expect(
        resolveExpiredSubscriptionStatus(
          trial,
          at('2026-10-13T00:00:00.000Z'),
          0,
        ),
      ).toBe('trial_expired')
    })

    it('não aplica a carência da manual', () => {
      expect(
        resolveExpiredSubscriptionStatus(trial, at('2026-10-13T10:00:00Z'), 3),
      ).toBe('trial_expired')
    })
  })

  describe('manual ativa', () => {
    const manual = {
      status: 'active' as const,
      modality: 'manual' as const,
      currentPeriodEnd: endOf('2026-10-10'),
    }

    it('vira past_due depois do período, sem carência', () => {
      expect(
        resolveExpiredSubscriptionStatus(
          manual,
          at('2026-10-11T00:00:00.000Z'),
          0,
        ),
      ).toBe('past_due')
    })

    it('continua ativa no último dia', () => {
      expect(
        resolveExpiredSubscriptionStatus(manual, at('2026-10-10T12:00:00Z'), 0),
      ).toBeNull()
    })

    it('continua ativa dentro da carência', () => {
      // Dois dias depois do fim, carência de 3.
      expect(
        resolveExpiredSubscriptionStatus(manual, at('2026-10-12T12:00:00Z'), 3),
      ).toBeNull()
    })

    it('vira past_due depois da carência', () => {
      // Quatro dias depois do fim, carência de 3.
      expect(
        resolveExpiredSubscriptionStatus(manual, at('2026-10-14T12:00:00Z'), 3),
      ).toBe('past_due')
    })

    it('renovada para o futuro continua ativa', () => {
      expect(
        resolveExpiredSubscriptionStatus(
          { ...manual, currentPeriodEnd: endOf('2026-11-10') },
          at('2026-10-13T12:00:00Z'),
          0,
        ),
      ).toBeNull()
    })
  })

  it('não altera stripe ativa vencida', () => {
    expect(
      resolveExpiredSubscriptionStatus(
        {
          status: 'active',
          modality: 'stripe',
          currentPeriodEnd: endOf('2026-01-01'),
        },
        at('2026-10-13T12:00:00Z'),
        0,
      ),
    ).toBeNull()
  })

  it.each(['past_due', 'cancelled', 'trial_expired'] as const)(
    'não altera status %s',
    status => {
      expect(
        resolveExpiredSubscriptionStatus(
          { status, modality: 'manual', currentPeriodEnd: endOf('2026-01-01') },
          at('2026-10-13T12:00:00Z'),
          0,
        ),
      ).toBeNull()
    },
  )
})

describe('resolvePastDueAction', () => {
  /** "Vencido em" como o mapper ancora: início do dia, em UTC. */
  const dayOf = (day: string) => new Date(`${day}T00:00:00.000Z`)
  const pastDue = (pastDueAt: Date | null) => ({
    status: 'past_due' as const,
    modality: 'manual' as const,
    pastDueAt,
  })
  const vencidaEm0311 = pastDue(dayOf('2026-11-03'))

  it('manual vencida sem data recebe a data', () => {
    expect(
      resolvePastDueAction(pastDue(null), at('2026-11-03T14:00:00Z')),
    ).toBe('stamp')
  })

  it('quarto dia não faz nada', () => {
    expect(
      resolvePastDueAction(vencidaEm0311, at('2026-11-07T23:00:00Z')),
    ).toBeNull()
  })

  it('quinto dia desassina as linhas', () => {
    expect(
      resolvePastDueAction(vencidaEm0311, at('2026-11-08T00:10:00Z')),
    ).toBe('unsubscribe-lines')
  })

  it('entre o quinto e o décimo dia continua pedindo a desassinatura', () => {
    expect(
      resolvePastDueAction(vencidaEm0311, at('2026-11-12T12:00:00Z')),
    ).toBe('unsubscribe-lines')
  })

  it('décimo dia cancela', () => {
    expect(
      resolvePastDueAction(vencidaEm0311, at('2026-11-13T08:00:00Z')),
    ).toBe('cancel')
  })

  it('Stripe vencida não entra', () => {
    expect(
      resolvePastDueAction(
        { ...vencidaEm0311, modality: 'stripe' },
        at('2026-11-20T08:00:00Z'),
      ),
    ).toBeNull()
  })

  it('outro status não entra', () => {
    expect(
      resolvePastDueAction(
        { ...vencidaEm0311, status: 'trial_expired' },
        at('2026-12-20T08:00:00Z'),
      ),
    ).toBeNull()
  })
})
