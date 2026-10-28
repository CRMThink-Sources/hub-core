import { describe, expect, it } from 'vitest'
import { mapBackofficeActionError } from './map-backoffice-action-error'
import { mapAdminLineError } from './map-admin-line-error'
import {
  PortalAppNotFoundError,
  ProviderEffectsDisabledError,
} from '../domain/errors/portal-domain.errors'
import {
  SubscriptionActionRefusedError,
  SubscriptionNotInAppError,
  SubscriptionPeriodEndError,
} from '../domain/errors/subscription-action.errors'

describe('mapBackofficeActionError', () => {
  it('efeitos de provider desligados: 409 provider-effects-disabled', () => {
    expect(
      mapBackofficeActionError(new ProviderEffectsDisabledError()),
    ).toEqual({
      status: 409,
      result: {
        error: 'Efeitos de provider desligados neste ambiente',
        reason: 'provider-effects-disabled',
      },
    })
  })

  it('assinatura Stripe: 409 gateway-managed', () => {
    const response = mapBackofficeActionError(
      new SubscriptionActionRefusedError('gateway-managed'),
    )

    expect(response?.status).toBe(409)
    expect(response?.result).toMatchObject({ reason: 'gateway-managed' })
  })

  it('fim de período: 422 com o motivo', () => {
    const response = mapBackofficeActionError(
      new SubscriptionPeriodEndError('period-end-required'),
    )

    expect(response?.status).toBe(422)
    expect(response?.result).toMatchObject({ reason: 'period-end-required' })
  })

  it('assinatura de outra instalação e app inexistente: 404', () => {
    expect(
      mapBackofficeActionError(new SubscriptionNotInAppError('s-1'))?.status,
    ).toBe(404)
    expect(mapBackofficeActionError(new PortalAppNotFoundError())?.status).toBe(
      404,
    )
  })

  it('erro de outra família: undefined', () => {
    expect(mapBackofficeActionError(new Error('x'))).toBeUndefined()
  })
})

describe('mapAdminLineError', () => {
  it('ações de linha também respondem 409 provider-effects-disabled', () => {
    const response = mapAdminLineError(new ProviderEffectsDisabledError())

    expect(response?.status).toBe(409)
    expect(response?.result).toMatchObject({
      reason: 'provider-effects-disabled',
    })
  })
})
