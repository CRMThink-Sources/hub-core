import { describe, expect, it, vi } from 'vitest'
import {
  loadAplicationContext,
  toAplicationContextState,
  type AplicationContextPayload,
} from './aplication-context'

const payload: AplicationContextPayload = {
  customer: { id: 'domain-1', name: 'acme.bitrix24.com.br', memberId: 'm-1' },
  aplication: {
    id: 'installed-1',
    spaId: '1060-42',
    appCode: 'crmthink.thinkzap',
    title: 'ThinkZap',
    active: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
  },
  subscriptions: [
    {
      id: 's1',
      name: 'Assinatura s1',
      status: 'active',
      currentPeriodStart: '2026-07-01T00:00:00.000Z',
      currentPeriodEnd: '2026-08-01T00:00:00.000Z',
      plan: { id: 'plan-1', name: 'Conector WhatsApp', amount: 9900 },
      items: [
        {
          id: 'i1',
          name: 'Linha 1',
          status: 'active',
          metadata: { provider: 'ZAPI', zApiInstanceId: 'Z-1' },
        },
        {
          id: 'i2',
          name: 'Linha 2',
          status: 'cancelled',
          metadata: { provider: 'NONE' },
        },
      ],
    },
  ],
}

describe('toAplicationContextState', () => {
  it('mapeia 200 para ready com o billing derivado', () => {
    const state = toAplicationContextState({ kind: 'ok', data: payload })

    expect(state).toMatchObject({
      status: 'ready',
      customer: payload.customer,
      aplication: payload.aplication,
      billing: {
        hasSubscription: true,
        status: 'ACTIVE',
        connectorQuantity: 1,
        trialEndsAt: null,
      },
    })
  })

  it('mapeia 200 sem assinaturas para ready com lista vazia', () => {
    const state = toAplicationContextState({
      kind: 'ok',
      data: { ...payload, subscriptions: [] },
    })

    expect(state).toMatchObject({
      status: 'ready',
      subscriptions: [],
      billing: { hasSubscription: false, status: null, connectorQuantity: 0 },
    })
  })

  it.each([401, 403])('mapeia %s para unauthenticated', (status: number) => {
    expect(toAplicationContextState({ kind: 'status', status })).toEqual({
      status: 'unauthenticated',
    })
  })

  it('mapeia 404 para not-found', () => {
    expect(toAplicationContextState({ kind: 'status', status: 404 })).toEqual({
      status: 'not-found',
    })
  })

  it('mapeia 502 para error, não para lista vazia', () => {
    const state = toAplicationContextState({
      kind: 'status',
      status: 502,
      message: 'Bitrix indisponível',
    })

    expect(state).toEqual({ status: 'error', message: 'Bitrix indisponível' })
  })

  it('mapeia 500 para error', () => {
    expect(
      toAplicationContextState({ kind: 'status', status: 500 }).status,
    ).toBe('error')
  })

  it('mapeia falha de rede para error', () => {
    expect(
      toAplicationContextState({ kind: 'network', message: 'offline' }),
    ).toEqual({ status: 'error', message: 'offline' })
  })

  it('trata payload sem shape esperado como error, não como ready vazio', () => {
    expect(toAplicationContextState({ kind: 'ok', data: {} }).status).toBe(
      'error',
    )
    expect(toAplicationContextState({ kind: 'ok', data: null }).status).toBe(
      'error',
    )
  })

  it('normaliza subscriptions ausente para lista vazia', () => {
    const state = toAplicationContextState({
      kind: 'ok',
      data: { customer: payload.customer, aplication: payload.aplication },
    })

    expect(state).toMatchObject({ status: 'ready', subscriptions: [] })
  })
})

describe('loadAplicationContext', () => {
  it('não dispara requisição quando não há token', async () => {
    const request = vi.fn()

    const state = await loadAplicationContext({
      readToken: () => null,
      request,
    })

    expect(state).toEqual({ status: 'unauthenticated' })
    expect(request).not.toHaveBeenCalled()
  })

  it('passa o token para a requisição e devolve o estado mapeado', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ kind: 'ok' as const, data: payload })

    const state = await loadAplicationContext({
      readToken: () => 'jwt-1',
      request,
    })

    expect(request).toHaveBeenCalledWith('jwt-1')
    expect(state.status).toBe('ready')
  })

  it('propaga not-found do backend', async () => {
    const state = await loadAplicationContext({
      readToken: () => 'jwt-1',
      request: () => Promise.resolve({ kind: 'status', status: 404 }),
    })

    expect(state).toEqual({ status: 'not-found' })
  })
})
