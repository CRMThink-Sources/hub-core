import type { PortalDomainDetail } from '../domain/entities/portal-domain'
import { PortalDomainNotFoundError } from '../domain/errors/portal-domain.errors'
import type { PortalDomainReadRepository } from '../domain/repositories/portal-domain-read.repository'
import {
  PortalHydrationDeps,
  hydrateAppContracts,
  hydrateAppTitles,
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

    const [titled] = await hydrateAppTitles([domain], this.hydration.titles)

    return hydrateAppContracts(titled ?? domain, this.hydration)
  }
}
