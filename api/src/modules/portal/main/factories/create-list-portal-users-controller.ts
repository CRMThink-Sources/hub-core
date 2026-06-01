import { Controller } from '@/shared/presentation/controller'
import { ListPortalUsers } from '../../application/list-portal-users'
import { ListPortalUsersController } from '../../presentation/controllers/list-portal-users-controller'
import { PrismaPortalUserRepository } from '../../infra/persistence/prisma-portal-user.repository'

export const createListPortalUsersController = (): Controller => {
  const portalUserRepository = new PrismaPortalUserRepository()
  const listPortalUsers = new ListPortalUsers(portalUserRepository)

  return new ListPortalUsersController(listPortalUsers)
}
