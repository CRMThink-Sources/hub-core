import { Controller } from '@/shared/presentation/controller'
import { ListAllowedUsersController } from '../presentation/controllers/access/list-allowed-users.controller'
import { PrismaAllowedUserRepository } from '../infra/persistence/repositories/prisma-allowed-user.repository'

export const makeListAllowedUsersController = (): Controller => {
  return new ListAllowedUsersController(new PrismaAllowedUserRepository())
}
