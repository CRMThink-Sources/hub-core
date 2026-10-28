import { describe, expect, it } from 'vitest'
import { resolveProviderBillingAction } from './resolve-provider-billing-action'

const SUBSCRIBED = { subscribedAt: '2026-10-01T00:00:00.000Z' }
const UNSUBSCRIBED = { unsubscribedAt: '2026-10-01T00:00:00.000Z' }

describe('resolveProviderBillingAction', () => {
  describe('item ativo', () => {
    /**
     * A modalidade não entra na regra: manual e Stripe chegam aqui como o mesmo status
     * `active`. É o caso que faltava — a manual nunca era assinada.
     */
    it('assina sob pai ativo quando não há marca', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'active',
          parentStatus: 'active',
          mirror: null,
        }),
      ).toEqual({ action: 'subscribe' })
    })

    it('reassina sob pai ativo quando a marca é de desassinado', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'active',
          parentStatus: 'active',
          mirror: UNSUBSCRIBED,
        }),
      ).toEqual({ action: 'subscribe' })
    })

    it('não assina de novo o que já está marcado como assinado', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'active',
          parentStatus: 'active',
          mirror: SUBSCRIBED,
        }),
      ).toEqual({ action: 'noop', reason: 'in-sync' })
    })

    it.each(['trialing', 'trial_expired'] as const)(
      'nunca assina sob pai %s',
      parentStatus => {
        expect(
          resolveProviderBillingAction({
            itemStatus: 'active',
            parentStatus,
            mirror: null,
          }),
        ).toEqual({ action: 'noop', reason: 'parent-trial' })
      },
    )

    it('não assina sob pai past_due', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'active',
          parentStatus: 'past_due',
          mirror: null,
        }),
      ).toEqual({ action: 'noop', reason: 'parent-inactive' })
    })

    /** Inadimplência é transitória: linha já assinada continua assinada. */
    it('não desassina sob pai past_due', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'active',
          parentStatus: 'past_due',
          mirror: SUBSCRIBED,
        }),
      ).toEqual({ action: 'noop', reason: 'in-sync' })
    })

    it('não reassina sob pai cancelado — mudança de comportamento intencional', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'active',
          parentStatus: 'cancelled',
          mirror: UNSUBSCRIBED,
        }),
      ).toEqual({ action: 'noop', reason: 'in-sync' })
    })

    it('não desassina linha assinada sem pai legível', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'active',
          parentStatus: null,
          mirror: SUBSCRIBED,
        }),
      ).toEqual({ action: 'noop', reason: 'in-sync' })
    })

    it('não assina sem pai', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'active',
          parentStatus: null,
          mirror: null,
        }),
      ).toEqual({ action: 'noop', reason: 'parent-missing' })
    })
  })

  describe('pai cancelado', () => {
    it('desassina linha ativa marcada como assinada', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'active',
          parentStatus: 'cancelled',
          mirror: SUBSCRIBED,
        }),
      ).toEqual({ action: 'unsubscribe', reason: 'parent-cancelled' })
    })

    /**
     * Sem marca nenhuma: linha Stripe anterior à marca, ou manual assinada fora do
     * produto. Exigir `subscribedAt` deixaria essas linhas cobradas para sempre.
     */
    it('desassina linha ativa sem marca', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'active',
          parentStatus: 'cancelled',
          mirror: null,
        }),
      ).toEqual({ action: 'unsubscribe', reason: 'parent-cancelled' })
    })

    it('desassina linha cancelada sem marca', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'cancelled',
          parentStatus: 'cancelled',
          mirror: null,
        }),
      ).toEqual({ action: 'unsubscribe', reason: 'parent-cancelled' })
    })

    it('não desassina de novo o que já está marcado', () => {
      for (const itemStatus of ['active', 'cancelled'] as const) {
        expect(
          resolveProviderBillingAction({
            itemStatus,
            parentStatus: 'cancelled',
            mirror: UNSUBSCRIBED,
          }),
        ).toEqual({ action: 'noop', reason: 'in-sync' })
      }
    })
  })

  describe('item cancelado', () => {
    it('desassina sem marca, sob pai não cancelado', () => {
      for (const parentStatus of ['active', 'past_due', null] as const) {
        expect(
          resolveProviderBillingAction({
            itemStatus: 'cancelled',
            parentStatus,
            mirror: null,
          }),
        ).toEqual({ action: 'unsubscribe', reason: 'item-cancelled' })
      }
    })

    it('desassina o que estava marcado como assinado', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'cancelled',
          parentStatus: 'active',
          mirror: SUBSCRIBED,
        }),
      ).toEqual({ action: 'unsubscribe', reason: 'item-cancelled' })
    })

    it('não desassina de novo o que já está marcado', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'cancelled',
          parentStatus: 'active',
          mirror: UNSUBSCRIBED,
        }),
      ).toEqual({ action: 'noop', reason: 'in-sync' })
    })
  })
})

describe('resolveProviderBillingAction — verificação de assinaturas', () => {
  describe('past-due-expired', () => {
    it('desassina linha ativa assinada de pai vencido', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'active',
          parentStatus: 'past_due',
          mirror: SUBSCRIBED,
          mode: 'past-due-expired',
        }),
      ).toEqual({ action: 'unsubscribe', reason: 'parent-past-due-expired' })
    })

    it('desassina linha sem marca nenhuma', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'cancelled',
          parentStatus: 'past_due',
          mirror: null,
          mode: 'past-due-expired',
        }),
      ).toEqual({ action: 'unsubscribe', reason: 'parent-past-due-expired' })
    })

    it('não repete o que já tem a marca de desassinado', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'active',
          parentStatus: 'past_due',
          mirror: UNSUBSCRIBED,
          mode: 'past-due-expired',
        }),
      ).toEqual({ action: 'noop', reason: 'in-sync' })
    })
  })

  describe('reconcile', () => {
    it('assina linha ativa de pai ativo mesmo com a marca de assinado', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'active',
          parentStatus: 'active',
          mirror: SUBSCRIBED,
          mode: 'reconcile',
        }),
      ).toEqual({ action: 'subscribe' })
    })

    it('não assina linha cancelada', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'cancelled',
          parentStatus: 'active',
          mirror: null,
          mode: 'reconcile',
        }),
      ).toEqual({ action: 'noop', reason: 'in-sync' })
    })

    it.each(['past_due', 'cancelled', 'trialing', 'trial_expired'] as const)(
      'não assina sob pai %s',
      parentStatus => {
        expect(
          resolveProviderBillingAction({
            itemStatus: 'active',
            parentStatus,
            mirror: null,
            mode: 'reconcile',
          }),
        ).toMatchObject({ action: 'noop' })
      },
    )
  })

  it('sem mode, vale a regra de evento', () => {
    expect(
      resolveProviderBillingAction({
        itemStatus: 'active',
        parentStatus: 'past_due',
        mirror: SUBSCRIBED,
      }),
    ).toEqual({ action: 'noop', reason: 'in-sync' })
  })
})
