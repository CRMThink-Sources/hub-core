import type {
  PortalDomainDetail,
  PortalDomainSummary,
} from '../domain/entities/portal-domain'
import { PortalDomainNotFoundError } from '../domain/errors/portal-domain.errors'
import type { PortalDomainReadRepository } from '../domain/repositories/portal-domain-read.repository'
import {
  PortalHydrationDeps,
  hydrateAppContracts,
  hydrateAppMirrors,
} from './helpers/hydrate-portal-apps'

/**
 * Detalhe do cliente no portal admin: identidade do banco, título e contrato da SPA.
 *
 * O contrato entra só aqui, e por app com espelho — ver `hydrateAppContracts`. Falha de
 * leitura marca o bloco daquele app como indisponível em vez de derrubar a tela: o
 * portal admin é a ferramenta que o suporte usa justamente quando algo está fora do ar,
 * inclusive o CRM interno.
 */
export class GetPortalDomainDetail {
  constructor(
    private readonly portalDomainReadRepository: PortalDomainReadRepository,
    private readonly hydration: PortalHydrationDeps,
  ) {}

  async execute(id: string): Promise<PortalDomainDetail> {
    const domain = await this.portalDomainReadRepository.findById(id)

    if (!domain) {
      throw new PortalDomainNotFoundError()
    }

    const [titled] = await hydrateAppMirrors([domain], this.hydration.titles)
    const hydrated = await hydrateAppContracts(titled ?? domain, this.hydration)

    return { ...hydrated, summary: summarize(hydrated) }
  }
}

/**
 * Indicadores do topo do detalhe, derivados do que já foi hidratado — nenhuma leitura
 * extra. `no-mirror` não deixa o resumo incompleto: ali não há contrato possível, então
 * zero é o número certo. Só `unavailable` é desconhecido.
 */
export function summarize(domain: PortalDomainDetail): PortalDomainSummary {
  let activeSubscriptions = 0
  let lines = 0
  let incomplete = false

  for (const app of domain.apps) {
    if (app.contract?.status === 'unavailable') incomplete = true
    if (app.contract?.status !== 'ok') continue

    for (const subscription of app.contract.subscriptions) {
      if (subscription.status === 'active') activeSubscriptions += 1
      if (subscription.status !== 'cancelled') lines += subscription.lineCount
    }
  }

  return {
    apps: domain.apps.length,
    activeSubscriptions,
    lines,
    mcpUsers: domain.mcpUserCount,
    incomplete,
  }
}
