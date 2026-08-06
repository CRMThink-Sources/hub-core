import { describe, expect, it } from 'vitest'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { isProviderUnavailableError } from './is-provider-unavailable-error'

const apiError = (status: number | undefined, body: unknown = {}) =>
  new HubMessageApiError(
    status,
    'POST',
    '/v1/channels/chan_1/messages',
    body,
    new Error('cause'),
  )

describe('isProviderUnavailableError', () => {
  /** O caso real: serviço interno da HubMessage fora, payload irrelevante. */
  it('classifica 502 como indisponibilidade', () => {
    expect(
      isProviderUnavailableError(
        apiError(502, { error: 'barling returned status 502' }),
      ),
    ).toBe(true)
  })

  it.each([500, 503, 504])('classifica %i como indisponibilidade', status => {
    expect(isProviderUnavailableError(apiError(status))).toBe(true)
  })

  /** Sem resposta HTTP: rede, DNS, timeout. */
  it('classifica ausência de status como indisponibilidade', () => {
    expect(isProviderUnavailableError(apiError(undefined))).toBe(true)
  })

  it.each([400, 401, 404, 422, 429])(
    'não classifica %i como indisponibilidade',
    status => {
      expect(isProviderUnavailableError(apiError(status))).toBe(false)
    },
  )

  it('não classifica erro que não é do client HubMessage', () => {
    expect(isProviderUnavailableError(new Error('boom'))).toBe(false)
    expect(isProviderUnavailableError(undefined)).toBe(false)
  })
})
