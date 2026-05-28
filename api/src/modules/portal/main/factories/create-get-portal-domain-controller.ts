import { Controller } from '@/shared/presentation/controller'
import { GetPortalDomainDetail } from '../../application/get-portal-domain-detail'
import { PrismaPortalDomainReadRepository } from '../../infra/persistence/prisma-portal-domain-read.repository'
import { GetPortalDomainController } from '../../presentation/controllers/get-domain-controller'

export const createGetPortalDomainController = (): Controller => {
  const portalDomainReadRepository = new PrismaPortalDomainReadRepository()
  const getPortalDomainDetail = new GetPortalDomainDetail(
    portalDomainReadRepository,
  )

  return new GetPortalDomainController(getPortalDomainDetail)
}
