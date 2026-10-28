import { describe, expect, it } from 'vitest'
import {
  lineActions,
  linesToUnsubscribe,
  minPeriodEnd,
  periodEnded,
  refusalMessage,
  subscribeLinesOutcome,
  subscriptionActions,
} from './admin-subscription-actions'
import type { AppSubscription, AppSubscriptionItem } from './portal-domains'

const item = (
  overrides: Partial<AppSubscriptionItem> = {},
): AppSubscriptionItem => ({
  id: 'item-1',
  name: 'Linha',
  status: 'active',
  metadata: { provider: 'ZAPI', zApiInstanceId: 'Z-1' },
  hasCredential: true,
  providerBilling: 'subscribed',
  ...overrides,
})

const subscription = (
  overrides: Partial<AppSubscription> = {},
): AppSubscription => ({
  id: 'sub-1',
  name: 'Assinatura',
  status: 'active',
  modality: 'manual',
  currentPeriodStart: '2026-10-01T00:00:00.000Z',
  currentPeriodEnd: '2026-10-31T23:59:59.999Z',
  planName: 'Mensal',
  productName: 'ThinkZap',
  items: [item()],
  ...overrides,
})

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}|${JSON.stringify(options)}` : key

const conflict = (reason?: string, status = 409) => ({
  response: { status, data: { result: { error: 'x', reason } } },
})

describe('subscriptionActions', () => {
  it('manual ativa: inativar e assinar todas; ativar não', () => {
    expect(subscriptionActions(subscription(), true)).toEqual({
      manageable: true,
      canActivate: false,
      canDeactivate: true,
      canSubscribeLines: true,
      disabledReason: null,
    })
  })

  it('manual cancelada: ativar; inativar não', () => {
    const state = subscriptionActions(
      subscription({ status: 'cancelled' }),
      true,
    )

    expect(state.canActivate).toBe(true)
    expect(state.canDeactivate).toBe(false)
  })

  it('Stripe: nem ativar nem inativar, mas assinar todas sim', () => {
    const state = subscriptionActions(
      subscription({ modality: 'stripe', status: 'cancelled' }),
      true,
    )

    expect(state.manageable).toBe(false)
    expect(state.canActivate).toBe(false)
    expect(state.canDeactivate).toBe(false)
    expect(state.canSubscribeLines).toBe(true)
  })

  it('homologação: tudo desabilitado com o motivo', () => {
    const state = subscriptionActions(
      subscription({ status: 'cancelled' }),
      false,
    )

    expect(state).toMatchObject({
      canActivate: false,
      canDeactivate: false,
      canSubscribeLines: false,
      disabledReason: 'provider-effects-disabled',
    })
  })
})

describe('lineActions', () => {
  it('linha com credencial: habilitada', () => {
    expect(lineActions(item(), true)).toEqual({
      enabled: true,
      disabledReason: null,
    })
  })

  it('sem credencial: desabilitada com o motivo', () => {
    expect(lineActions(item({ hasCredential: false }), true)).toEqual({
      enabled: false,
      disabledReason: 'no-credential',
    })
  })

  it('homologação tem precedência sobre a credencial', () => {
    expect(lineActions(item({ hasCredential: false }), false)).toEqual({
      enabled: false,
      disabledReason: 'provider-effects-disabled',
    })
  })
})

describe('linesToUnsubscribe', () => {
  it('conta linhas de verdade com credencial', () => {
    expect(
      linesToUnsubscribe(
        subscription({
          items: [
            item(),
            item({ id: 'i2', hasCredential: false }),
            item({ id: 'i3', metadata: { provider: 'NONE' } }),
            item({ id: 'i4', metadata: { provider: 'HUBMESSAGE' } }),
          ],
        }),
      ),
    ).toBe(2)
  })
})

describe('período', () => {
  const NOW = new Date('2026-11-05T15:00:00.000Z')

  it('periodEnded compara o fim do período com agora', () => {
    expect(periodEnded(subscription(), NOW)).toBe(true)
    expect(
      periodEnded(
        subscription({ currentPeriodEnd: '2026-11-30T23:59:59.999Z' }),
        NOW,
      ),
    ).toBe(false)
  })

  it('minPeriodEnd é amanhã em UTC', () => {
    expect(minPeriodEnd(NOW)).toBe('2026-11-06')
    expect(minPeriodEnd(new Date('2026-12-31T23:30:00.000Z'))).toBe(
      '2027-01-01',
    )
  })
})

describe('refusalMessage', () => {
  it('motivo conhecido vira a mensagem do motivo', () => {
    expect(refusalMessage(conflict('gateway-managed'), t)).toBe(
      'subscriptions.refusal.gateway-managed',
    )
    expect(refusalMessage(conflict('period-end-required', 422), t)).toBe(
      'subscriptions.refusal.period-end-required',
    )
  })

  it('422 sem motivo é a credencial ausente da linha', () => {
    expect(refusalMessage(conflict(undefined, 422), t)).toBe(
      'subscriptions.refusal.no-credential',
    )
  })

  it('o resto vira a genérica', () => {
    expect(refusalMessage(new Error('Network Error'), t)).toBe(
      'subscriptions.refusal.generic',
    )
  })
})

describe('subscribeLinesOutcome', () => {
  it('sem falha: sucesso com as contagens', () => {
    const outcome = subscribeLinesOutcome(
      { items: 3, subscribed: 1, unsubscribed: 0, failed: 0, ignored: 2 },
      t,
    )

    expect(outcome.tone).toBe('success')
    expect(outcome.message).toContain('subscriptions.result.lines|')
  })

  it('falha parcial: atenção, com a contagem de falhas', () => {
    const outcome = subscribeLinesOutcome(
      { items: 3, subscribed: 2, unsubscribed: 0, failed: 1, ignored: 0 },
      t,
    )

    expect(outcome.tone).toBe('warning')
    expect(outcome.message).toContain('subscriptions.result.linesPartial')
    expect(outcome.message).toContain('"failed":1')
    expect(outcome.message).toContain('"subscribed":2')
  })
})
