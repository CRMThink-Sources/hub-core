import { describe, expect, it } from 'vitest'

import { resolveExpiredSubscriptionStatus } from './subscription-expiration'

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
