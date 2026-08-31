import { describe, expect, it } from 'vitest'
import {
  deriveSubscriptionState,
  EMPTY_SUBSCRIPTION_STATE,
  podeAlterarAssinaturaExistente,
  referenceSubscription,
  type AplicationSubscriptionView,
  type SpaSubscriptionStatus,
  type UiSubscriptionStatus,
} from './derive-subscription-state'

const sub = (
  id: string,
  status: SpaSubscriptionStatus,
  currentPeriodEnd: string,
  itemStatuses: Array<'active' | 'cancelled'> = [],
): AplicationSubscriptionView => ({
  id,
  status,
  currentPeriodEnd,
  items: itemStatuses.map(s => ({ status: s })),
})

describe('deriveSubscriptionState', () => {
  it('devolve estado vazio para lista vazia', () => {
    expect(deriveSubscriptionState([])).toEqual(EMPTY_SUBSCRIPTION_STATE)
  })

  it('devolve estado vazio para payload ausente', () => {
    expect(deriveSubscriptionState(undefined)).toEqual(EMPTY_SUBSCRIPTION_STATE)
    expect(deriveSubscriptionState(null)).toEqual(EMPTY_SUBSCRIPTION_STATE)
  })

  it('normaliza o status da SPA para o vocabulário da UI', () => {
    expect(
      deriveSubscriptionState([
        sub('s1', 'active', '2026-08-01T00:00:00.000Z', ['active', 'active']),
      ]),
    ).toEqual({
      hasSubscription: true,
      status: 'ACTIVE',
      connectorQuantity: 2,
      trialEndsAt: null,
    })
  })

  it.each([
    ['active', 'ACTIVE'],
    ['past_due', 'PAST_DUE'],
    ['cancelled', 'CANCELLED'],
    ['trialing', 'TRIALING'],
    ['trial_expired', 'TRIAL_EXPIRED'],
  ] as const)(
    'mapeia %s para %s',
    (spa: SpaSubscriptionStatus, ui: UiSubscriptionStatus) => {
      expect(
        deriveSubscriptionState([sub('s1', spa, '2026-08-01T00:00:00.000Z')])
          .status,
      ).toBe(ui)
    },
  )

  it('expõe trialEndsAt como o fim do período quando está em trial', () => {
    expect(
      deriveSubscriptionState([
        sub('s1', 'trialing', '2026-08-15T00:00:00.000Z'),
      ]).trialEndsAt,
    ).toBe('2026-08-15T00:00:00.000Z')
  })

  it('não expõe trialEndsAt quando o status não é trial', () => {
    expect(
      deriveSubscriptionState([sub('s1', 'active', '2026-08-15T00:00:00.000Z')])
        .trialEndsAt,
    ).toBeNull()
  })

  /** Teste encerrado não tem data futura a anunciar. */
  it('não expõe trialEndsAt para teste expirado', () => {
    expect(
      deriveSubscriptionState([
        sub('s1', 'trial_expired', '2026-08-15T00:00:00.000Z'),
      ]).trialEndsAt,
    ).toBeNull()
  })

  it('marca hasSubscription mesmo quando a única assinatura está cancelada', () => {
    const state = deriveSubscriptionState([
      sub('s1', 'cancelled', '2026-06-01T00:00:00.000Z', ['active']),
    ])

    expect(state.hasSubscription).toBe(true)
    expect(state.status).toBe('CANCELLED')
    // Assinatura cancelada não conta linha contratada.
    expect(state.connectorQuantity).toBe(0)
  })

  describe('connectorQuantity', () => {
    it('conta itens ativos de todas as assinaturas não canceladas', () => {
      const state = deriveSubscriptionState([
        sub('s1', 'active', '2026-08-01T00:00:00.000Z', ['active', 'active']),
        sub('s2', 'trialing', '2026-08-10T00:00:00.000Z', ['active']),
      ])

      expect(state.connectorQuantity).toBe(3)
    })

    it('ignora itens cancelados', () => {
      const state = deriveSubscriptionState([
        sub('s1', 'active', '2026-08-01T00:00:00.000Z', [
          'active',
          'cancelled',
          'cancelled',
        ]),
      ])

      expect(state.connectorQuantity).toBe(1)
    })

    it('ignora itens de assinatura cancelada', () => {
      const state = deriveSubscriptionState([
        sub('s1', 'active', '2026-08-01T00:00:00.000Z', ['active']),
        sub('s2', 'cancelled', '2026-05-01T00:00:00.000Z', [
          'active',
          'active',
        ]),
      ])

      expect(state.connectorQuantity).toBe(1)
    })

    /**
     * Contar as linhas de um teste encerrado como contratadas é o mesmo erro que
     * contar as de uma cancelada — daí o conjunto de status mortos.
     */
    it('ignora itens de assinatura com teste expirado', () => {
      const state = deriveSubscriptionState([
        sub('s1', 'active', '2026-08-01T00:00:00.000Z', ['active']),
        sub('s2', 'trial_expired', '2026-05-01T00:00:00.000Z', [
          'active',
          'active',
        ]),
      ])

      expect(state.connectorQuantity).toBe(1)
    })

    it('conta zero quando as assinaturas não têm itens', () => {
      expect(
        deriveSubscriptionState([
          sub('s1', 'active', '2026-08-01T00:00:00.000Z'),
        ]).connectorQuantity,
      ).toBe(0)
    })
  })
})

describe('referenceSubscription', () => {
  it('escolhe a não cancelada de maior currentPeriodEnd', () => {
    const chosen = referenceSubscription([
      sub('antiga', 'active', '2026-08-01T00:00:00.000Z'),
      sub('nova', 'past_due', '2026-09-01T00:00:00.000Z'),
    ])

    expect(chosen?.id).toBe('nova')
  })

  it('ignora teste expirado quando existe assinatura viva, mesmo com período maior', () => {
    const chosen = referenceSubscription([
      sub('expirado', 'trial_expired', '2027-01-01T00:00:00.000Z'),
      sub('viva', 'active', '2026-08-01T00:00:00.000Z'),
    ])

    expect(chosen?.id).toBe('viva')
  })

  it('ignora canceladas quando existe alguma viva, mesmo com período maior', () => {
    const chosen = referenceSubscription([
      sub('cancelada', 'cancelled', '2027-01-01T00:00:00.000Z'),
      sub('viva', 'active', '2026-08-01T00:00:00.000Z'),
    ])

    expect(chosen?.id).toBe('viva')
  })

  it('cai para a cancelada de maior período quando todas estão canceladas', () => {
    const chosen = referenceSubscription([
      sub('velha', 'cancelled', '2026-01-01T00:00:00.000Z'),
      sub('recente', 'cancelled', '2026-06-01T00:00:00.000Z'),
    ])

    expect(chosen?.id).toBe('recente')
  })

  it('resolve empate pela primeira da lista, de forma estável', () => {
    const mesmoFim = '2026-08-01T00:00:00.000Z'
    const lista = [
      sub('primeira', 'active', mesmoFim),
      sub('segunda', 'active', mesmoFim),
    ]

    expect(referenceSubscription(lista)?.id).toBe('primeira')
    expect(referenceSubscription(lista)?.id).toBe('primeira')
  })

  it('não deixa data inválida vencer a comparação', () => {
    const chosen = referenceSubscription([
      sub('invalida', 'active', 'nao-e-data'),
      sub('valida', 'active', '2026-08-01T00:00:00.000Z'),
    ])

    expect(chosen?.id).toBe('valida')
  })

  it('devolve null para lista vazia', () => {
    expect(referenceSubscription([])).toBeNull()
  })
})

describe('podeAlterarAssinaturaExistente', () => {
  it.each([
    ['ACTIVE', true],
    ['PAST_DUE', true],
    ['TRIALING', false],
    ['CANCELLED', false],
  ] as const)('%s -> %s', (status: UiSubscriptionStatus, expected: boolean) => {
    expect(podeAlterarAssinaturaExistente(status)).toBe(expected)
  })

  it('nega para status ausente', () => {
    expect(podeAlterarAssinaturaExistente(null)).toBe(false)
    expect(podeAlterarAssinaturaExistente(undefined)).toBe(false)
  })
})
