import { Controller } from '@/shared/presentation/controller'
import { ListPortalDomains } from '../../application/list-portal-domains'
import { PrismaPortalDomainReadRepository } from '../../infra/persistence/prisma-portal-domain-read.repository'
import { ListPortalDomainsController } from '../../presentation/controllers/list-domains-controller'

export const createListPortalDomainsController = (): Controller => {
  const portalDomainReadRepository = new PrismaPortalDomainReadRepository()
  const listPortalDomains = new ListPortalDomains(portalDomainReadRepository)

  return new ListPortalDomainsController(listPortalDomains)
}
