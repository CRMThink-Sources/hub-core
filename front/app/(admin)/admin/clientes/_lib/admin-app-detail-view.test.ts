import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AdminAppHeader } from '@/components/layouts/admin/admin-app-detail-page'
import {
  ContractOverview,
  MirrorPanel,
  contractedLines,
  linkMirrorErrorMessage,
} from '@/components/layouts/admin/admin-app-overview-section'
import type {
  AppSubscription,
  PortalAppDetail,
  PortalAppMirror,
} from '@/lib/portal-domains'

/** Sem instância de i18n, o `t` devolve a chave: as asserções olham as chaves. */
vi.spyOn(console, 'warn').mockImplementation(() => {})

const APP: PortalAppDetail = {
  id: 'app-1',
  appCodeId: 'crmthink.thinkzap',
  appCode: 'thinkzap',
  appName: 'ThinkZap',
  title: 'ThinkZap Matriz',
  spaId: '1060-1',
  mirror: 'linked',
  status: 'ACTIVE',
  email: 'admin@acme.com',
  installedAt: '2026-01-01T12:00:00.000Z',
  locale: 'pt',
  domain: { id: 'domain-1', name: 'acme.bitrix24.com.br', memberId: 'm-1' },
}

const renderMirror = (mirror: PortalAppMirror, error: string | null = null) =>
  renderToStaticMarkup(
    createElement(MirrorPanel, {
      mirror,
      linking: false,
      error,
      onLink: () => {},
    }),
  )

/** `t` de teste: devolve a chave com as opções, para conferir a interpolação. */
const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}|${JSON.stringify(options)}` : key

const conflict = (reason: string, ids: string[] = []) => ({
  response: { status: 409, data: { result: { error: 'x', reason, ids } } },
})

const subscription = (
  status: string,
  providers: string[],
): AppSubscription => ({
  id: `s-${status}`,
  name: 'Assinatura',
  status,
  modality: 'manual',
  currentPeriodStart: '2026-10-01T00:00:00.000Z',
  currentPeriodEnd: '2026-11-01T23:59:59.999Z',
  planName: 'Mensal',
  productName: 'ThinkZap',
  items: providers.map((provider, index) => ({
    id: `i-${status}-${index}`,
    name: 'Linha',
    status: 'active',
    metadata: { provider },
    hasCredential: true,
    providerBilling: 'subscribed',
  })),
})

describe('AdminAppHeader', () => {
  it('breadcrumb até o cliente, título, app code e os dois estados', () => {
    const html = renderToStaticMarkup(
      createElement(AdminAppHeader, {
        domainId: 'domain-1',
        app: { ...APP, mirror: 'mirror-missing' },
      }),
    )

    expect(html).toContain('href="/admin/clientes"')
    expect(html).toContain('href="/admin/clientes/domain-1"')
    expect(html).toContain('ThinkZap Matriz')
    expect(html).toContain('thinkzap')
    expect(html).toContain('app.ACTIVE')
    expect(html).toContain('mirror.mirror-missing')
  })
})

describe('MirrorPanel', () => {
  it.each<PortalAppMirror>(['no-mirror', 'mirror-missing'])(
    '%s oferece "Vincular espelho" e explica o impacto',
    mirror => {
      const html = renderMirror(mirror)

      expect(html).toContain('overview.linkMirror')
      expect(html).toContain(`overview.mirrorImpact.${mirror}`)
    },
  )

  it.each<PortalAppMirror>(['linked', 'unknown'])(
    '%s não oferece vincular',
    mirror => {
      expect(renderMirror(mirror)).not.toContain('overview.linkMirror<')
    },
  )

  it('mostra o erro da última tentativa como alerta', () => {
    const html = renderMirror('no-mirror', 'Itens duplicados: 512, 900')

    expect(html).toContain('role="alert"')
    expect(html).toContain('Itens duplicados: 512, 900')
  })
})

describe('linkMirrorErrorMessage', () => {
  it('ambiguous traz os ids encontrados', () => {
    expect(
      linkMirrorErrorMessage(conflict('ambiguous', ['512', '900']), t),
    ).toBe('overview.linkMirrorError.ambiguous|{"ids":"512, 900"}')
  })

  it('motivo desconhecido ou erro de rede vira a mensagem genérica', () => {
    expect(linkMirrorErrorMessage(conflict('outro'), t)).toBe(
      'overview.linkMirrorError.generic',
    )
    expect(linkMirrorErrorMessage(new Error('Network Error'), t)).toBe(
      'overview.linkMirrorError.generic',
    )
  })
})

describe('ContractOverview', () => {
  const render = (state: Parameters<typeof ContractOverview>[0]['state']) =>
    renderToStaticMarkup(
      createElement(ContractOverview, { state, onOpenSubscriptions: () => {} }),
    )

  it('erro de leitura não é "sem assinatura"', () => {
    const html = render({ kind: 'error' })

    expect(html).toContain('overview.contractUnavailable')
    expect(html).not.toContain('overview.contractEmpty')
  })

  it('assinaturas agrupadas por status, com as linhas contratadas', () => {
    const html = render({
      kind: 'ready',
      subscriptions: [
        subscription('active', ['ZAPI', 'HUBMESSAGE']),
        subscription('cancelled', ['ZAPI']),
      ],
    })

    expect(html).toContain('subscription.active')
    expect(html).toContain('subscription.cancelled')
    expect(html).toContain('overview.contractLines')
  })
})

describe('contractedLines', () => {
  it('conta só linhas reais de assinaturas não canceladas', () => {
    expect(
      contractedLines([
        subscription('active', ['ZAPI', 'NONE']),
        subscription('past_due', ['HUBMESSAGE']),
        subscription('cancelled', ['ZAPI', 'ZAPI']),
      ]),
    ).toBe(2)
  })
})
