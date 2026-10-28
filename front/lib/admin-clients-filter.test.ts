import { describe, expect, it } from 'vitest'
import {
  EMPTY_CLIENTS_FILTER,
  availableAppCodes,
  filterClients,
  isFilterActive,
  paginate,
} from './admin-clients-filter'
import type {
  PortalAppMirror,
  PortalDomainApp,
  PortalDomainDetail,
} from './portal-domains'

const app = (
  appCodeId: string,
  mirror: PortalAppMirror = 'linked',
): PortalDomainApp => ({
  id: `${appCodeId}-app`,
  appCodeId,
  appCode: appCodeId,
  appName: appCodeId === 'crmthink.thinkzap' ? 'ThinkZap' : 'Extrator',
  title: appCodeId,
  spaId: mirror === 'no-mirror' ? null : '1',
  mirror,
  status: 'ACTIVE',
  email: 'a@b.com',
  installedAt: '2026-01-01T00:00:00.000Z',
})

const domain = (
  name: string,
  memberId: string,
  apps: PortalDomainApp[] = [],
): PortalDomainDetail => ({
  id: name,
  name,
  memberId,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  mcpUserCount: 0,
  apps,
})

const DOMAINS = [
  domain('acme.bitrix24.com.br', 'abc123', [app('crmthink.thinkzap')]),
  domain('beta.bitrix24.com', 'XYZ789', [
    app('crmthink.extrator', 'no-mirror'),
  ]),
  domain('gama.bitrix24.com', 'gama001', [
    app('crmthink.thinkzap', 'mirror-missing'),
  ]),
  domain('delta.bitrix24.com', 'delta01', [
    app('crmthink.thinkzap', 'unknown'),
  ]),
]

const names = (domains: PortalDomainDetail[]) => domains.map(d => d.name)

describe('filterClients', () => {
  it('sem filtro devolve todos', () => {
    expect(filterClients(DOMAINS, EMPTY_CLIENTS_FILTER)).toHaveLength(4)
  })

  it('busca por parte do domínio, sem diferenciar maiúsculas', () => {
    expect(
      names(
        filterClients(DOMAINS, { ...EMPTY_CLIENTS_FILTER, search: 'ACME' }),
      ),
    ).toEqual(['acme.bitrix24.com.br'])
  })

  it('busca por parte do member id', () => {
    expect(
      names(
        filterClients(DOMAINS, { ...EMPTY_CLIENTS_FILTER, search: 'xyz7' }),
      ),
    ).toEqual(['beta.bitrix24.com'])
  })

  it('filtra por aplicação', () => {
    expect(
      names(
        filterClients(DOMAINS, {
          ...EMPTY_CLIENTS_FILTER,
          appCodeId: 'crmthink.extrator',
        }),
      ),
    ).toEqual(['beta.bitrix24.com'])
  })

  it('pendência de espelho: sem espelho e espelho apagado, não o não verificado', () => {
    expect(
      names(
        filterClients(DOMAINS, {
          ...EMPTY_CLIENTS_FILTER,
          pendingMirror: true,
        }),
      ),
    ).toEqual(['beta.bitrix24.com', 'gama.bitrix24.com'])
  })

  it('combina busca e filtros', () => {
    expect(
      filterClients(DOMAINS, {
        search: 'gama',
        appCodeId: 'crmthink.thinkzap',
        pendingMirror: true,
      }),
    ).toHaveLength(1)
    expect(
      filterClients(DOMAINS, {
        search: 'acme',
        appCodeId: '',
        pendingMirror: true,
      }),
    ).toHaveLength(0)
  })
})

describe('isFilterActive', () => {
  it('detecta qualquer filtro ligado', () => {
    expect(isFilterActive(EMPTY_CLIENTS_FILTER)).toBe(false)
    expect(isFilterActive({ ...EMPTY_CLIENTS_FILTER, search: '  ' })).toBe(
      false,
    )
    expect(
      isFilterActive({ ...EMPTY_CLIENTS_FILTER, pendingMirror: true }),
    ).toBe(true)
  })
})

describe('availableAppCodes', () => {
  it('lista os app codes presentes, sem repetir, por nome', () => {
    expect(availableAppCodes(DOMAINS)).toEqual([
      { id: 'crmthink.extrator', name: 'Extrator' },
      { id: 'crmthink.thinkzap', name: 'ThinkZap' },
    ])
  })
})

describe('paginate', () => {
  const many = Array.from({ length: 60 }, (_, i) =>
    domain(`d${i}.bitrix24.com`, `m${i}`),
  )

  it('25 por página, com a faixa mostrada', () => {
    const page = paginate(many, 2)

    expect(page.items).toHaveLength(25)
    expect(page).toMatchObject({ page: 2, pageCount: 3, from: 26, to: 50 })
  })

  it('última página parcial', () => {
    expect(paginate(many, 3)).toMatchObject({ from: 51, to: 60 })
  })

  it('página fora do intervalo cai na última válida', () => {
    expect(paginate(many, 9).page).toBe(3)
    expect(paginate(many, 0).page).toBe(1)
  })

  it('lista vazia tem uma página e faixa zerada', () => {
    expect(paginate([], 1)).toMatchObject({
      items: [],
      page: 1,
      pageCount: 1,
      from: 0,
      to: 0,
    })
  })
})
