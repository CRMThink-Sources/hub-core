import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  AdminClientDetailView,
  ContractSummary,
} from '@/components/layouts/admin/admin-client-detail-page'
import type {
  PortalAppContract,
  PortalDomainApp,
  PortalDomainDetail,
} from '@/lib/portal-domains'

/** Sem instância de i18n, o `t` devolve a chave: as asserções olham as chaves. */
vi.spyOn(console, 'warn').mockImplementation(() => {})

const app = (overrides: Partial<PortalDomainApp> = {}): PortalDomainApp => ({
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
  ...overrides,
})

const domain = (
  apps: PortalDomainApp[],
  summary: PortalDomainDetail['summary'] = {
    apps: apps.length,
    activeSubscriptions: 1,
    lines: 3,
    mcpUsers: 2,
    incomplete: false,
  },
): PortalDomainDetail => ({
  id: 'domain-1',
  name: 'acme.bitrix24.com.br',
  memberId: 'member-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  mcpUserCount: 2,
  apps,
  summary,
})

const renderView = (value: PortalDomainDetail) =>
  renderToStaticMarkup(createElement(AdminClientDetailView, { domain: value }))

const renderContract = (contract: PortalAppContract | undefined) =>
  renderToStaticMarkup(createElement(ContractSummary, { contract }))

describe('AdminClientDetailView', () => {
  it('cabeçalho com breadcrumb e link do portal em nova aba', () => {
    const html = renderView(domain([app()]))

    expect(html).toContain('href="/admin/clientes"')
    expect(html).toContain('href="https://acme.bitrix24.com.br"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('mostra os quatro indicadores com os números do resumo', () => {
    const html = renderView(domain([app()]))

    for (const key of [
      'stats.apps',
      'stats.activeSubscriptions',
      'stats.lines',
      'stats.mcpUsers',
    ]) {
      expect(html).toContain(key)
    }
    expect(html).not.toContain('stats.incomplete')
  })

  it('resumo incompleto avisa nos indicadores de contrato', () => {
    const html = renderView(
      domain([app()], {
        apps: 1,
        activeSubscriptions: 0,
        lines: 0,
        mcpUsers: 0,
        incomplete: true,
      }),
    )

    expect(html.match(/stats\.incomplete/g)).toHaveLength(2)
  })

  it('todo card de aplicação leva ao detalhe dela, qualquer que seja o app', () => {
    const html = renderView(
      domain([
        app(),
        app({ id: 'app-2', appCodeId: 'crmthink.extrator', title: 'Extrator' }),
      ]),
    )

    expect(html).toContain('href="/admin/clientes/domain-1/apps/app-1"')
    expect(html).toContain('href="/admin/clientes/domain-1/apps/app-2"')
  })

  it('status da instalação e espelho fora do normal aparecem traduzidos', () => {
    const html = renderView(
      domain([app({ status: 'SUSPENDED', mirror: 'mirror-missing' })]),
    )

    expect(html).toContain('app.SUSPENDED')
    expect(html).toContain('mirror.mirror-missing')
    expect(html).not.toContain('>SUSPENDED<')
  })

  it('sem aplicações mostra o estado vazio', () => {
    expect(renderView(domain([]))).toContain('appsEmpty')
  })
})

describe('ContractSummary', () => {
  it('sem espelho', () => {
    expect(renderContract({ status: 'no-mirror' })).toContain(
      'contract.noMirror',
    )
  })

  it('indisponível não é "sem assinatura"', () => {
    const html = renderContract({ status: 'unavailable' })

    expect(html).toContain('contract.unavailable')
    expect(html).not.toContain('contract.none')
  })

  it('sem assinatura', () => {
    expect(renderContract({ status: 'ok', subscriptions: [] })).toContain(
      'contract.none',
    )
  })

  it('com assinatura: status traduzido, plano e linhas', () => {
    const html = renderContract({
      status: 'ok',
      subscriptions: [
        {
          id: 's-1',
          status: 'past_due',
          modality: 'manual',
          planName: 'ThinkZap Mensal',
          currentPeriodEnd: '2026-12-01T23:59:59.999Z',
          lineCount: 3,
        },
      ],
    })

    expect(html).toContain('subscription.past_due')
    expect(html).toContain('ThinkZap Mensal')
    expect(html).toContain('contract.lines')
    expect(html).not.toContain('>past_due<')
  })
})
