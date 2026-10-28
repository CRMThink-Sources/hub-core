import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  SubscriptionCard,
  SubscriptionLineRow,
  SubscriptionsStatusView,
  type SectionState,
} from '@/components/layouts/admin/admin-app-subscriptions-section'
import type { AppSubscription, AppSubscriptionItem } from '@/lib/portal-domains'

/** Sem instância de i18n, o `t` devolve a chave: as asserções olham as chaves. */
vi.spyOn(console, 'warn').mockImplementation(() => {})

const noop = () => {}

const item = (
  overrides: Partial<AppSubscriptionItem> = {},
): AppSubscriptionItem => ({
  id: 'item-1',
  name: 'Linha Comercial',
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
  name: 'ThinkZap Mensal',
  status: 'active',
  modality: 'manual',
  currentPeriodStart: '2026-10-01T00:00:00.000Z',
  currentPeriodEnd: '2026-10-31T23:59:59.999Z',
  planName: 'Mensal',
  productName: 'ThinkZap',
  items: [item(), item({ id: 'item-2', name: 'Linha Suporte' })],
  ...overrides,
})

const renderStatus = (state: SectionState) =>
  renderToStaticMarkup(
    createElement(SubscriptionsStatusView, { state, onRetry: noop }),
  )

const renderCard = (
  value: AppSubscription,
  options: { busy?: boolean; providerEffectsEnabled?: boolean } = {},
) =>
  renderToStaticMarkup(
    createElement(SubscriptionCard, {
      subscription: value,
      providerEffectsEnabled: options.providerEffectsEnabled ?? true,
      busy: options.busy ?? false,
      onActivate: noop,
      onDeactivate: noop,
      onSubscribeLines: noop,
      onLineSubscribe: noop,
      onLineUnsubscribe: noop,
    }),
  )

const renderLine = (
  value: AppSubscriptionItem,
  providerEffectsEnabled = true,
) =>
  renderToStaticMarkup(
    createElement(SubscriptionLineRow, {
      item: value,
      providerEffectsEnabled,
      busy: false,
      onSubscribe: noop,
      onUnsubscribe: noop,
    }),
  )

/** O `<button>` cujo texto é a chave dada, inteiro. */
/**
 * A tag de abertura do `<button>` cujo texto termina com a chave, sem o `class` — a
 * classe tem `disabled:cursor-not-allowed`, e o que interessa é o atributo.
 */
const button = (html: string, key: string) =>
  html
    .match(new RegExp(`<button[^>]*>(?:(?!</button>).)*${key}</button>`))?.[0]
    .match(/^<button[^>]*>/)?.[0]
    .replace(/\sclass="[^"]*"/, '')

describe('SubscriptionsStatusView', () => {
  it('carregando', () => {
    expect(renderStatus({ kind: 'loading' })).toContain('aria-busy')
  })

  it('erro de leitura com "Tentar de novo", nunca "sem assinatura"', () => {
    const html = renderStatus({ kind: 'error' })

    expect(html).toContain('subscriptions.errorTitle')
    expect(html).toContain('subscriptions.retry')
    expect(html).not.toContain('subscriptions.emptyTitle')
  })

  it('sem espelho', () => {
    expect(renderStatus({ kind: 'no-mirror' })).toContain(
      'subscriptions.noMirrorTitle',
    )
  })

  it('espelhada e sem assinatura', () => {
    expect(
      renderStatus({
        kind: 'ready',
        subscriptions: [],
        providerEffectsEnabled: true,
      }),
    ).toContain('subscriptions.emptyTitle')
  })
})

describe('SubscriptionCard', () => {
  it('manual ativa: status, modalidade, linhas e as ações de inativar e assinar todas', () => {
    const html = renderCard(subscription())

    expect(html).toContain('subscription.active')
    expect(html).toContain('modality.manual')
    expect(html).toContain('Linha Comercial')
    expect(html).toContain('Linha Suporte')
    expect(html).toContain('subscriptions.actions.deactivate')
    expect(html).toContain('subscriptions.actions.subscribeLines')
    expect(html).not.toContain('subscriptions.actions.activate<')
  })

  it('manual cancelada oferece ativar', () => {
    const html = renderCard(subscription({ status: 'cancelled' }))

    expect(html).toContain('subscriptions.actions.activate')
    expect(html).not.toContain('subscriptions.actions.deactivate')
  })

  it('Stripe: sem ativar nem inativar, com a explicação', () => {
    const html = renderCard(
      subscription({ modality: 'stripe', gatewayId: 'sub_123' }),
    )

    expect(html).toContain('subscriptions.stripeManaged')
    expect(html).not.toContain('subscriptions.actions.activate<')
    expect(html).not.toContain('subscriptions.actions.deactivate')
    expect(html).toContain('subscriptions.actions.subscribeLines')
    expect(html).toContain('sub_123')
  })

  it('ocupada: as ações ficam desabilitadas', () => {
    const html = renderCard(subscription(), { busy: true })

    expect(button(html, 'subscriptions.actions.subscribeLines')).toContain(
      'disabled',
    )
    expect(button(html, 'subscriptions.actions.deactivate')).toContain(
      'disabled',
    )
    expect(html).toContain('aria-busy="true"')
  })

  it('homologação: ações desabilitadas com o motivo', () => {
    const html = renderCard(subscription(), { providerEffectsEnabled: false })

    const subscribeAll = button(html, 'subscriptions.actions.subscribeLines')
    expect(subscribeAll).toContain('disabled')
    expect(subscribeAll).toContain(
      'title="subscriptions.providerEffectsDisabled"',
    )
  })
})

describe('SubscriptionLineRow', () => {
  it('linha com credencial: estado no provider e ações habilitadas', () => {
    const html = renderLine(item({ providerBilling: 'unknown' }))

    expect(html).toContain('providerBilling.unknown')
    expect(button(html, 'subscriptions.actions.lineSubscribe')).not.toContain(
      'disabled',
    )
  })

  it('sem credencial: ações desabilitadas e o motivo à vista', () => {
    const html = renderLine(item({ hasCredential: false }))

    expect(html).toContain('subscriptions.noCredential')
    expect(button(html, 'subscriptions.actions.lineSubscribe')).toContain(
      'disabled',
    )
    expect(button(html, 'subscriptions.actions.lineUnsubscribe')).toContain(
      'disabled',
    )
  })

  it('homologação: ações desabilitadas', () => {
    const html = renderLine(item(), false)

    expect(button(html, 'subscriptions.actions.lineSubscribe')).toContain(
      'disabled',
    )
  })

  it('item sem conector (NONE) não tem ações de provider', () => {
    const html = renderLine(item({ metadata: { provider: 'NONE' } }))

    expect(html).toContain('subscriptions.noProvider')
    expect(html).not.toContain('subscriptions.actions.lineSubscribe')
  })
})
