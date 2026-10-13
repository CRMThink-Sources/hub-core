import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { isHubMessageAlreadyPaid } from './hubmessage.client'
import { isZApiAlreadySubscribed } from './z-api.client'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

/** Erro HTTP como o axios real produz, com o corpo devolvido pelo provider. */
const httpError = (status: number, data: unknown) =>
  new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data,
  })

/**
 * Os corpos são os devolvidos pelos providers num subscribe sobre recurso já assinado
 * (validados em 2026-10-13). É o caso das linhas assinadas antes da marca de assinado:
 * o primeiro UPDATE depois do deploy as assina de novo, e isso não pode virar retry.
 */
describe('subscribe sobre recurso já assinado', () => {
  it('reconhece a resposta da Z-API', () => {
    expect(
      isZApiAlreadySubscribed(
        httpError(400, {
          subscriptionStatus: 'ALREADY_ACTIVE',
          error: 'there is already a paid subscription for this instance',
        }),
      ),
    ).toBe(true)
  })

  it('reconhece a resposta da HubMessage', () => {
    expect(
      isHubMessageAlreadyPaid(
        httpError(400, {
          checkoutId: null,
          url: null,
          type: 'ALREADY_PAID',
          message: 'Instância já está ativa.',
        }),
      ),
    ).toBe(true)
  })

  it('não engole outras falhas do provider', () => {
    const other = httpError(500, { error: 'internal' })

    expect(isZApiAlreadySubscribed(other)).toBe(false)
    expect(isHubMessageAlreadyPaid(other)).toBe(false)
    expect(isZApiAlreadySubscribed(new Error('rede'))).toBe(false)
    expect(isHubMessageAlreadyPaid(httpError(400, 'texto'))).toBe(false)
  })
})
