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

    it.each(['past_due', 'cancelled'] as const)(
      'não assina sob pai %s',
      parentStatus => {
        expect(
          resolveProviderBillingAction({
            itemStatus: 'active',
            parentStatus,
            mirror: null,
          }),
        ).toEqual({ action: 'noop', reason: 'parent-inactive' })
      },
    )

    it('não reassina sob pai cancelado — mudança de comportamento intencional', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'active',
          parentStatus: 'cancelled',
          mirror: UNSUBSCRIBED,
        }),
      ).toEqual({ action: 'noop', reason: 'parent-inactive' })
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

  describe('item cancelado', () => {
    it('desassina sem marca, qualquer que seja o pai', () => {
      for (const parentStatus of ['active', 'cancelled', null] as const) {
        expect(
          resolveProviderBillingAction({
            itemStatus: 'cancelled',
            parentStatus,
            mirror: null,
          }),
        ).toEqual({ action: 'unsubscribe' })
      }
    })

    it('desassina o que estava marcado como assinado', () => {
      expect(
        resolveProviderBillingAction({
          itemStatus: 'cancelled',
          parentStatus: 'active',
          mirror: SUBSCRIBED,
        }),
      ).toEqual({ action: 'unsubscribe' })
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
