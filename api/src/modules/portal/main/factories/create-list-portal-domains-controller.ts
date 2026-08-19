import { Controller } from '@/shared/presentation/controller'
import { ListPortalDomains } from '../../application/list-portal-domains'
import { PrismaPortalDomainReadRepository } from '../../infra/persistence/prisma-portal-domain-read.repository'
import { ListPortalDomainsController } from '../../presentation/controllers/list-domains-controller'
import { makeAplicationTitleReader } from '../make-portal-hydration'

export const createListPortalDomainsController = (): Controller => {
  const portalDomainReadRepository = new PrismaPortalDomainReadRepository()
  const listPortalDomains = new ListPortalDomains(
    portalDomainReadRepository,
    makeAplicationTitleReader(),
  )

  return new ListPortalDomainsController(listPortalDomains)
}
