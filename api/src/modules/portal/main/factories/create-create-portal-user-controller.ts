import { Controller } from '@/shared/presentation/controller'
import { CreatePortalUser } from '../../application/create-portal-user'
import { CreatePortalUserController } from '../../presentation/controllers/create-portal-user-controller'
import { PrismaPortalUserRepository } from '../../infra/persistence/prisma-portal-user.repository'

export const createCreatePortalUserController = (): Controller => {
  const portalUserRepository = new PrismaPortalUserRepository()
  const createPortalUser = new CreatePortalUser(portalUserRepository)

  return new CreatePortalUserController(createPortalUser)
}
