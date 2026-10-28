import type { PortalDomainDetail } from './portal-domains'

export const CLIENTS_PAGE_SIZE = 25

export type ClientsFilter = {
  /** Domínio ou member id, sem diferenciar maiúsculas. */
  search: string
  /** `appCodeId` (`crmthink.thinkzap`); vazio = todas. */
  appCodeId: string
  /** Só clientes com instalação "Sem espelho" ou "Espelho apagado". */
  pendingMirror: boolean
}

export const EMPTY_CLIENTS_FILTER: ClientsFilter = {
  search: '',
  appCodeId: '',
  pendingMirror: false,
}

/** `unknown` não é pendência: "não verificado" não pede ação de ninguém. */
const isPendingMirror = (mirror: string) =>
  mirror === 'no-mirror' || mirror === 'mirror-missing'

export const hasPendingMirror = (domain: PortalDomainDetail): boolean =>
  domain.apps.some(app => isPendingMirror(app.mirror))

export const isFilterActive = (filter: ClientsFilter): boolean =>
  filter.search.trim() !== '' || filter.appCodeId !== '' || filter.pendingMirror

export function filterClients(
  domains: PortalDomainDetail[],
  filter: ClientsFilter,
): PortalDomainDetail[] {
  const search = filter.search.trim().toLowerCase()

  return domains.filter(domain => {
    if (
      search &&
      !domain.name.toLowerCase().includes(search) &&
      !domain.memberId.toLowerCase().includes(search)
    ) {
      return false
    }

    if (
      filter.appCodeId &&
      !domain.apps.some(app => app.appCodeId === filter.appCodeId)
    ) {
      return false
    }

    if (filter.pendingMirror && !hasPendingMirror(domain)) return false

    return true
  })
}

/** Os app codes presentes na listagem, para o filtro: id e o nome do app code. */
export function availableAppCodes(
  domains: PortalDomainDetail[],
): Array<{ id: string; name: string }> {
  const byId = new Map<string, string>()
  for (const app of domains.flatMap(domain => domain.apps)) {
    if (!byId.has(app.appCodeId)) byId.set(app.appCodeId, app.appName)
  }

  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export type ClientsPage = {
  items: PortalDomainDetail[]
  page: number
  pageCount: number
  /** Posição do primeiro e do último item, base 1, para "1–25 de 80". */
  from: number
  to: number
}

/** Página pedida fora do intervalo cai na última válida (ex.: filtro encolheu a lista). */
export function paginate(
  items: PortalDomainDetail[],
  page: number,
  size = CLIENTS_PAGE_SIZE,
): ClientsPage {
  const pageCount = Math.max(1, Math.ceil(items.length / size))
  const current = Math.min(Math.max(1, page), pageCount)
  const start = (current - 1) * size
  const slice = items.slice(start, start + size)

  return {
    items: slice,
    page: current,
    pageCount,
    from: slice.length === 0 ? 0 : start + 1,
    to: start + slice.length,
  }
}
