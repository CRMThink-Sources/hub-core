import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ClientsListBody } from '@/components/layouts/admin/admin-clients-page'
import { paginate } from '@/lib/admin-clients-filter'
import type { PortalAppMirror, PortalDomainDetail } from '@/lib/portal-domains'

/**
 * Sem instância de i18n, o `t` do react-i18next devolve a própria chave: as asserções
 * olham as chaves, que é o que o componente escolhe mostrar.
 */
vi.spyOn(console, 'warn').mockImplementation(() => {})

const domain = (
  name: string,
  mirror: PortalAppMirror = 'linked',
): PortalDomainDetail => ({
  id: `id-${name}`,
  name,
  memberId: `member-${name}`,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  mcpUserCount: 0,
  apps: [
    {
      id: `app-${name}`,
      appCodeId: 'crmthink.thinkzap',
      appCode: 'thinkzap',
      appName: 'ThinkZap',
      title: `ThinkZap ${name}`,
      spaId: mirror === 'no-mirror' ? null : '1',
      mirror,
      status: 'ACTIVE',
      email: 'a@b.com',
      installedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
})

const render = (
  domains: PortalDomainDetail[],
  options: { loading?: boolean; total?: number } = {},
) =>
  renderToStaticMarkup(
    createElement(ClientsListBody, {
      loading: options.loading ?? false,
      page: paginate(domains, 1),
      filteredTotal: options.total ?? domains.length,
      onClearFilters: () => {},
      onPageChange: () => {},
    }),
  )

describe('ClientsListBody', () => {
  it('nenhum resultado mostra o estado vazio com "Limpar filtros"', () => {
    const html = render([])

    expect(html).toContain('noResultsTitle')
    expect(html).toContain('filters.clear')
    expect(html).not.toContain('<table')
  })

  it('carregando mostra o esqueleto, não a tabela', () => {
    const html = render([domain('acme.bitrix24.com')], { loading: true })

    expect(html).toContain('aria-busy')
    expect(html).not.toContain('<table')
  })

  it('cada cliente leva ao detalhe, na tabela e no card do celular', () => {
    const html = render([domain('acme.bitrix24.com')])

    const links = html.match(
      /href="\/admin\/clientes\/id-acme\.bitrix24\.com"/g,
    )
    expect(links).toHaveLength(2)
  })

  it('espelho fora do normal aparece com badge; vinculado não', () => {
    const html = render([
      domain('ok.bitrix24.com', 'linked'),
      domain('sem.bitrix24.com', 'no-mirror'),
      domain('apagado.bitrix24.com', 'mirror-missing'),
    ])

    expect(html).toContain('mirror.no-mirror')
    expect(html).toContain('mirror.mirror-missing')
    expect(html).not.toContain('mirror.linked')
  })

  it('mostra a faixa da paginação', () => {
    const html = render([domain('acme.bitrix24.com')])

    expect(html).toContain('pagination.range')
  })
})
