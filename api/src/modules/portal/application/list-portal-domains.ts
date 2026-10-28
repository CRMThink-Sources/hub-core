import type { AplicationMirrorReader } from '@/modules/application/domain/repositories/aplication.repository'
import type { PortalDomainDetail } from '../domain/entities/portal-domain'
import type { PortalDomainReadRepository } from '../domain/repositories/portal-domain-read.repository'
import { hydrateAppMirrors } from './helpers/hydrate-portal-apps'

export type ListPortalDomainsResult = {
  domains: PortalDomainDetail[]
  total: number
}

/**
 * Listagem de clientes do portal admin.
 *
 * Identidade vem de `core_domains`/`core_apps` — o item da SPA 1060 é espelho de CRM,
 * que pode duplicar e pode ser apagado à mão, então cliente nenhum desaparece da tela
 * de suporte por causa dele. Da SPA vêm só o título e o estado do espelho, em lote.
 *
 * Contrato **não** é resolvido aqui: seria uma leitura de SPA por app de todo portal
 * registrado. Isso é do detalhe.
 */
export class ListPortalDomains {
  constructor(
    private readonly portalDomainReadRepository: PortalDomainReadRepository,
    private readonly mirrors: AplicationMirrorReader,
  ) {}

  async execute(): Promise<ListPortalDomainsResult> {
    const rows = await this.portalDomainReadRepository.listAll()
    const domains = await hydrateAppMirrors(rows, this.mirrors)

    return {
      domains,
      total: domains.length,
    }
  }
}
