import { Controller } from '@/shared/presentation/controller'
import { GetPortalSession } from '../../application/get-portal-session'
import { PortalSessionController } from '../../presentation/controllers/session-controller'
import { PrismaPortalUserRepository } from '../../infra/persistence/prisma-portal-user.repository'

export const createPortalSessionController = (): Controller => {
  const portalUserRepository = new PrismaPortalUserRepository()
  const getPortalSession = new GetPortalSession(portalUserRepository)

  return new PortalSessionController(getPortalSession)
}
